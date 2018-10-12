---
layout: post
title: "Persisten Memory Development Kit(PMDK) Notes 0: What it is and Quick Examples"
date: 2018-10-10
categories: [PMDK]
abstract: "PMDK is a super cool open source library developed and owned by intel. This lib is used to help users to implement applications on persistent memory just like using normal memory. Which is to say, basically, when we want to manage memory, we allocate a chunk, and use pointers to indicate where data is to build a logical image and do read and write, and that is exactly how to use persistent memory by this PMDK lib. There is a new pointer, persistent_ptr<type>, and it just can be used like a char*, super cool!"
abstract_img: ""
---
<br>
What is PMDK, some cool reference below:
1. [PMDK github site](https://github.com/pmem/pmdk)
2. [PMDK official site](http://pmem.io/)

> For me, PMDK helps me to use persistent memory just like using memory. I can use a special pointer named "persistent_ptr" to access every byte of the big chunk of persistent memory I allocated. And use lots of std::/boost:: data structures there.

<br>
## PART ONE ##
***
### So, let's firstly think about why Persistent Memory is cool? ###


If we want to use some data in the program life time, we can use any in memory structures like c based array, or std/boost data structures like map, list, vector, etc, and of course self-designed data structure to keep track of where data is.

While if we want to use those data after programs restart or share between programs. We need to store data somewhere not lives inside this program's context/userspace. Which is to say, options are files, databases(actually another type of file), sending to some long-run services. Any option results in a thousands of times greater latency than using memory. Beacuse we need either disk driver or network driver here.

While using persistent memory, it means we can access data by spending memory-speed latency, we can reuse the data after programs restart, system reboot and even data center servers migration!!!

### Why need a new lib to access persistent memory? ###


If the speed is that fast, why don't mount it as a normal disk (just use it as a SSD)? You must ask? Yes, of course you can use the PM device that way, and what's more, PMDK also tells you how to mount as an ordinaty device to your system by DAX mode. DAX is a directly access mode, so you won't need to go through page cache system which is a default option for most filesystem to speed up. Because you already have a memory(Persistent memory) device, you don't need another memory as your page cache.

But, the cooler way of using this device is by the lib "PMDK" !!

When you use PMDK to access Persisten memory or even a in-memory temp file for emulation, you can use it just like memory. Malloc, pointers, hashmap, map, tree, graph, yes, you don't need to worry how to serialize these data structure and how to make write and read efficiently, just mind the real algorithm, and data is consistenly and reliably staying in a non-volatile pereistent memory after you commit transactions.

### Transaction Support for PMDK ###

As a foundation, PMDK uses transation to read and write, we submit our lambda function to PMDK, it will keep data being read and written consistenly (In the right sequence, and no partially dirty issue), once the data committed, PMDK calls our lambda function to call our next step (Or wake/notify up your waiting thread).

<img alt="PMDK OVERVIEW" src="/static/img/2018-10-10-PMDK/PMDK_1.png" style="width: 300px">
<br>
## PART TWO ##
***
### PMDK c++ example and a java example ###

I think now, you get why I say PMDK is dope. And in this intro note, I want to show two most importand API (c++ and java).
And PMDK provides so many APIs, and I will cover in the third part for a brief introduction.

#### C++ EXAMPLE ####
C++ PMDK API called pmemobjc++, you can refer to [PMDK Notes 1: How to install](/2018/10/10/PMDK-Tutorial-1-How-to-install) for install details.

``` c++
#include <iostream>
#include <string>
#include <unistd.h>
#include <stdio.h>
#include <libpmemobj++/make_persistent.hpp>
#include <libpmemobj++/make_persistent_array.hpp>
#include <libpmemobj++/persistent_ptr.hpp>
#include <libpmemobj++/pool.hpp>
#include <libpmemobj++/transaction.hpp>

using pmem::obj::p;
using pmem::obj::persistent_ptr;
using pmem::obj::make_persistent;
using pmem::obj::transaction;
using pmem::obj::pool;
using namespace std;

#define PMEMPOOLSIZE 1024*1024*1024
#define DATASIZE 32
#define LOG(msg) std::cout << msg << "\n"

struct MEMBLOCK{
    persistent_ptr<MEMBLOCK> next;
    persistent_ptr<char[]> value_ptr;
    p<size_t> size;
};

int main() {
    const size_t size = PMEMPOOLSIZE;
    string path = "/mnt/mem/pmempool";
    pool<MEMBLOCK> pmpool;
	
    /* Open and create in persistent memory device */
    if ((access(path.c_str(), F_OK) != 0) && (size > 0)) {
        LOG("Creating filesystem pool, path=" << path << ", size=" << to_string(size));
        pmpool = pool<MEMBLOCK>::create(path.c_str(), "", size, S_IRWXU);
    } else {
        LOG("Opening pool, path=" << path);
        pmpool = pool<MEMBLOCK>::open(path.c_str(), "");
    }

    /* Get root persistent_ptr, 
    the first struct pointer 
    and link to the next one */
    auto block_ptr = pmpool.root();

    /* Cool part, submit your lambda func to pmpool
    , and when the func is ready to run (consistency design),
    it executes below lines.*/
	transaction::run(pmpool, [&] {
        /* Data structure looks like below
        MEMBLOCK0(root) -> MEMBLOCK1 -> MEMBLOCK2 -> ...
            ||                 ||           ||
            \/                 \/           \/
          char[]              char[]       char[]
        */
        auto next_block_ptr = make_persistent<MEMBLOCK>();
        auto data_ptr = make_persistent<char[]>(DATASIZE);
        block_ptr->value_ptr = data_ptr;
        block_ptr->size = DATASIZE;
        block_ptr->next = next_block_ptr;
        block_ptr = next_block_ptr;

        /* To write something, just like doing to a memory pointer */
		char* data_in_mem_ptr = data_ptr.get();
        memset(data_in_mem_ptr, 'a', DATASIZE);

        string data_str(data_in_mem_ptr, DATASIZE);
        LOG("Input Data: " << data_str);
    });

    pmpool.close();
}
```

Compile

``` bash
g++ example_libpmemobj++.cpp -o example_pmem++ -std=c++11 -lpmemobj
```

Verify lib links

```
ldd example_pmem++
linux-vdso.so.1 =>  (0x00007ffdaac7e000)
libpmemobj.so.1 => /usr/local/lib64/libpmemobj.so.1 (0x00007ff9d0ca3000)
libstdc++.so.6 => /lib64/libstdc++.so.6 (0x00007ff9d099c000)
libm.so.6 => /lib64/libm.so.6 (0x00007ff9d069a000)
libgcc_s.so.1 => /lib64/libgcc_s.so.1 (0x00007ff9d0484000)
libc.so.6 => /lib64/libc.so.6 (0x00007ff9d00b7000)
libpmem.so.1 => /usr/local/lib64/libpmem.so.1 (0x00007ff9cfe98000)
libdl.so.2 => /lib64/libdl.so.2 (0x00007ff9cfc94000)
libpthread.so.0 => /lib64/libpthread.so.0 (0x00007ff9cfa78000)
/lib64/ld-linux-x86-64.so.2 (0x00007ff9d0eda000)
```

Running

``` bash	
./example_pmem++
```

[Program output]:

``` bash
Creating filesystem pool, path=/mnt/mem/pmempool, size=1073741824
Input Data: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

Verify

``` bash
./example_pmem++_verify
```
[Program output]:

``` bash
Opening pool, path=/mnt/mem/pmempool
Find data: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

#### java EXAMPLE ####
Java PMDK API called llpl, you can refer to [PMDK Notes 1: How to install](/2018/10/10/PMDK-Tutorial-1-How-to-install) for install details.

``` java
package examples.string_store;

import lib.llpl.*;
import java.io.Console;
import java.util.Arrays;
import sun.misc.Unsafe;

public class Writer {
    public static void main(String[] args) {
        /*
        open and create persistent_pool file
        */
        Heap h = Heap.getHeap("/mnt/mem/persistent_pool", 1024*1024*1024L);

        Console c = System.console();
        c.readLine("press Enter to start");

        byte[] bytes = {(byte)'a', (byte)'b', (byte)'c', (byte)'d', (byte)'e',
                        (byte)'f', (byte)'g', (byte)'h', (byte)'i', (byte)'j',
                        (byte)'k', (byte)'l', (byte)'m', (byte)'n', (byte)'o',
                        (byte)'p', (byte)'q', (byte)'r', (byte)'s', (byte)'t'};
        int length = bytes.length;

        /*
        allocate a memory chunk from persistent pool
        */
        MemoryBlock<Transactional> mr = h.allocateMemoryBlock(Transactional.class, Integer.BYTES + length);
		
        /*
        copy bytes array to persistent memory
        */
        mr.copyFromArray(bytes, 0, 0, length);

        /*
        set the memory block as root, 
        and this memory block should point to the next, 
        so you can find any memory block after restart program
        */
        h.setRoot(mr.address());

        System.out.println("String successfully written.");

        /*
        get the actual address in memory of our data
        To check if it is correct.
        we check the value indexed of 10. Which is k
        */
        long addr = mr.payloadAddress(10);
        Unsafe UNSAFE;
        try {
            java.lang.reflect.Field f = Unsafe.class.getDeclaredField("theUnsafe");
            f.setAccessible(true);
            UNSAFE = (Unsafe)f.get(null);
        }
        catch (Exception e) {
            throw new RuntimeException("Unable to initialize UNSAFE.");
        }
        byte res = UNSAFE.getByte(addr);
        System.out.println("Address 10 is " + (char)res);
    }
}
```

Compile
``` bash
cd llpl/src
javac -cp ../target/classes examples/string_store/Writer.java
```

Running
``` bash
cd llpl/src
java -ea -cp ../target/classes:lib:target/test_classes:./ -Djava.library.path=../target/cppbuild examples/string_store/Writer
```

[Program output]:

``` bash
press Enter to start
String successfully written.
Address 10 is k
```

<br>
## PART THREE ##
***

Besides C++ and JAVA, PMDK provides bunch of other APIs

* [pmemkv](https://github.com/pmem/pmemkv) : read and right as a key-value store, it provides C++/C/Java/Ruby/Node.js apis.
* [librpmem](https://github.com/pmem/pmdk/tree/master/src/librpmem) : Write and read data from a persistent memory device over RDMA. 


