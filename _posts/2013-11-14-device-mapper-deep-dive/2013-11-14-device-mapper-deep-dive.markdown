---
layout: post
title: "Device-Mapper deep dive"
date: 2013-11-14 19:40
comments: true
categories: [Linux, Storage]
---
I used to stuck in all these terms and concepts for like really long time, just trying to get everything clear by writing.

##Storage subsystem
###Overview
![Device-Mapper Overview]({{ site.posts_img_path }}/2013-11-14-device-mapper-deep-dive/overview.png "Device-Mapper Overview")

BIO is the unit to map data in the memory to generic block offset.
When generic block layer gets bio units, it calls io scheduler to combine bios into request to specific device.
Then requests can be sent to real device or virtual block device like software raid or logic volume(using MD or Device Mapper modules).

![Device-Mapper]({{ site.posts_img_path }}/2013-11-14-device-mapper-deep-dive/bio.png "Device-Mapper")

Actually BIO units point to a much smaller unit named bio_vec which is the exactly unit point to the memory, and BIO also has one field record which block device and which sector it wanna to read/write.(Notice, the block device here is kind of a generic idea, could be some virtual block device)

The smart use of bio_vec help kernel to support scatter/Gather I/O, so that BIO can map some scatter part in mem to some continuous part in block device.

![Device-Mapper]({{ site.posts_img_path }}/2013-11-14-device-mapper-deep-dive/request.png "Device-Mapper")

When BIO unit received by generic block layer, kernel will do some "merge and sort" operations then hand the combined BIOs to block device. All these work can be done in the IO scheduler layer and then all BIO units are combined into one and one request, which also be linked by a pointer named "request_queue" store in bdev struct(gendisk).

Then the whole idea is pretty clear, there is a picture shows some important function to translate a fs syscall into requests to block devices.

![Device-Mapper]({{ site.posts_img_path }}/2013-11-14-device-mapper-deep-dive/functions.png "Device-Mapper")

Submit_bio is a generic api to submit bio to generic block layer(of course by its name...) 

generic_make_request puts BIO into bio_list, then \__generic_make_request will see if this bio is suitable to make request or it is delivered to some stack device like Device Mapper(in this situation, __generic_make_request will produce a new bio and call generic_make_request).

\__make_request_fn() then pus BIO into request_queue, if this function returns 0, the BIO is delivered to the real block device, or it may continues to call __make_request_fn until it delivered to real block device(like Device Mapper).

In fact, the request_queue also will not be directly tackled by block device, the device will use some method named "Plugging/Unplugging" to tackles these requests. 

![Device-Mapper]({{ site.posts_img_path }}/2013-11-14-device-mapper-deep-dive/structures.png "Device-Mapper")

Now let's see a linked graph of some important structs in block-level subsystem. Every block device has a field named gendisk(generic disk), and generic disk has a field to record its request_queue, and since each type of block device has its own implementation of read and write, the gendisk also has a field named private_data to point to the corresponding block device(also, the block device can be real or virtual).


## Then, after all the general idea of block-layer subsystem, let's talk about <code>Device Mapper</code>

### What is Device-Mapper
* A block device mapping facility available in Linux Kernel.
* A component required by LVM2 to support the mapping between logical volumes and physical storage devices.
* Device-mapper provides a generic way to create virtual layers of block devices that can do different things on top of real block devices like striping, concatenation, mirroring, snapshotting, etc...

### Here is the Usecase

Before lv creation

![Device-Mapper]({{ site.posts_img_path }}/2013-11-14-device-mapper-deep-dive/Before lv creation.png "Device-Mapper")

After lv creation

![Device-Mapper]({{ site.posts_img_path }}/2013-11-14-device-mapper-deep-dive/after lv creation.png "Device-Mapper")

The thing should notice here is that a dm-0 device in /sys/block is created, which indicates that Logic Volume is a "device mapper" device.

![Device-Mapper]({{ site.posts_img_path }}/2013-11-14-device-mapper-deep-dive/after lv creation2.png "Device-Mapper")

### another device mapper usecase

![Device-Mapper]({{ site.posts_img_path }}/2013-11-14-device-mapper-deep-dive/dm_usecase2.png "Device-Mapper")

### Here is the Device Mapper Overview

![Device-Mapper]({{ site.posts_img_path }}/2013-11-14-device-mapper-deep-dive/dm_overview.png "Device-Mapper")

![Device-Mapper]({{ site.posts_img_path }}/2013-11-14-device-mapper-deep-dive/dm_struct.png "Device-Mapper")

DM Devices in Ubuntu 12.10,kernel 3.6.3

![Device-Mapper]({{ site.posts_img_path }}/2013-11-14-device-mapper-deep-dive/dm_targets.png "Device-Mapper")

Linear Device target-type example

``` c linear-device-struct
static struct target_type linear_target = {   
	.name   = "linear",   
	.version = {1, 1, 0},   
	.module = THIS_MODULE,   
	.ctr    = linear_ctr,   
	.dtr    = linear_dtr,   
	.map    = linear_map,   
	.status = linear_status,   
	.ioctl  = linear_ioctl,   
	.merge  = linear_merge,   
	.iterate_devices = linear_iterate_devices,
}
```

### Let's see the codes

``` c How DM handle the device creation command?
int dm_create(int minor, struct mapped_device **result){
   	struct mapped_device *md;
    	md = alloc_dev(minor);   	
	if (!md)       		
		return -ENXIO;   	
	dm_sysfs_init(md);   	
	*result = md;   	
	return 0;
}
```

``` c How DM handle the read/write command? 
static void dm_request(struct request_queue *q, struct bio *bio)
{
	struct mapped_device *md = q->queuedata;

	if (dm_request_based(md))
		blk_queue_bio(q, bio);  //Using dm_target rules to reconstruct the bio
	else
		_dm_request(q, bio);    //split and process this bio
}
```
