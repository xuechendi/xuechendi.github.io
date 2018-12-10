---
layout: post
title: "Persisten Memory Development Kit(PMDK) Notes 2: Benchmark examples for multiple interfaces(c/c++/java)"
date: 2018-12-07
categories: [PMDK]
abstract: "PMDK is super cool, if you missed the introduction, please go to <a href='/2018/10/10/PMDK-Tutorial-0-What-it-is'>PMDK Notes 0: what it is and quick examples</a> to have a ramp up. For this blog, three benmark codes of using C, C++ and Java PMDK interface will be demonstrated to meet different applications."
abstract_img: ""
---

***

This blog records all my steps of building PMDK, PMDK C++ API(libpmemobj++), PMDK JAVA API(llpl) on Centos 7.3.
If you want to have a rampup of what PMDK is, and how it works, please refer to [PMDK Notes 0: what it is and quick examples](/2018/10/10/PMDK-Tutorial-0-What-it-is)

***
#### C++ write benchmark codes using [libpmemobj++](https://github.com/pmem/libpmemobj-cpp)

``` bash
# compile with
g++ write_bench.cpp -o aep_bench_writer -std=c++11 -lpmemobj -lboost_program_options -lpthread
```

``` bash
# run with
./aep_bench_writer -d /dev/dax0.0,/dev/dax1.0 -r 60 -t 1 -b 2
options:
  -h [ --help ]           Print help messages
  -d [ --device ] arg     pmem device path
  -r [ --runtime ] arg    runtime
  -t [ --thread_num ] arg parallel threads number
  -b [ --block_size ] arg block size for each request(MB/s)

```

#### libpmemobj implementation

``` c++
class Writer {
public:
    Writer(Monitor* mon, string dev, int bs, int thread_num):
        mon(mon),
        inflight(0),
        block_size(bs * 1024 * 1024),
        thread_num(thread_num) {
        /* Open and create in persistent memory device */
        printf("benchmark on %s, block size: %dMB, thread number: %d\n", dev.c_str(), bs, thread_num);

        const char *pool_layout_name = "libpmemobj_persistent_heap";
        pmpool = pmemobj_open(dev.c_str(), pool_layout_name);
        if (pmpool == NULL) {
            pmpool = pmemobj_create(dev.c_str(), pool_layout_name, 0, S_IRUSR | S_IWUSR);
        }
        if (pmpool == NULL) {
            printf("Failed to open pool %s\n", pmemobj_errormsg());
            fflush(stdout);
            exit(-1);
        }

        for (int i = 0; i < thread_num; i++) {
            thread_pool.push_back(thread(&Writer::run, this));
        }
    }

    ~Writer() {
        pmemobj_close(pmpool);
    }

    void stop() {
        for (auto it = thread_pool.begin(); it != thread_pool.end(); it++) {
            it->join();
        }
    }

private:
    vector<thread> thread_pool;
    PMEMobjpool *pmpool;
    uint64_t block_size;
    Monitor* mon;
    int thread_num;
    int inflight;
    std::mutex mtx;
    std::condition_variable cv;

    void run() {
        std::unique_lock<std::mutex> lck(mtx);
        while (mon->is_alive()) {
            exec();
            inflight++;
            while (inflight > thread_num) cv.wait(lck);
        }
    }

    void exec() {
        TX_BEGIN(pmpool) {
            char* address = (char*)pmemobj_direct(pmemobj_tx_zalloc(block_size, 0));
            pmemobj_tx_add_range_direct((const void *)address, block_size);
            memset(address, 'a', block_size);

            mon->incCommittedJobs();
            inflight--;
            cv.notify_all();
            
        } TX_ONABORT {
            exit(1);
        } TX_END
    }

};
```

#### libpmemobj++ implementation

``` c++
class Writer {
public:
    Writer(Monitor* mon, string dev, int bs, int thread_num):
        mon(mon),
        inflight(0),
        block_size(bs * 1024 * 1024),
        thread_num(thread_num) {
        /* Open and create in persistent memory device */
        printf("benchmark on %s, block size: %dMB, thread number: %d\n", dev.c_str(), bs, thread_num);
        //pmpool = pool<MEMBLOCK>::open(dev.c_str(), "");
        try {
            pmpool = pool<MEMBLOCK>::open(dev.c_str(), "");
        } catch (...) {
            pmpool = pool<MEMBLOCK>::create(dev.c_str(), "", 0, S_IRWXU);
        }
        block_ptr = pmpool.root();

        for (int i = 0; i < thread_num; i++) {
            thread_pool.push_back(thread(&Writer::run, this));
        }
    }

    ~Writer() {
        pmpool.close();
    }

    void stop() {
        for (auto it = thread_pool.begin(); it != thread_pool.end(); it++) {
            it->join();
        }
    }

private:
    vector<thread> thread_pool;
    pool<MEMBLOCK> pmpool;
    persistent_ptr<MEMBLOCK> block_ptr;
    uint64_t block_size;
    Monitor* mon;
    int thread_num;
    int inflight;
    std::mutex mtx;
    std::condition_variable cv;
    

    void run() {
        std::unique_lock<std::mutex> lck(mtx);
        while (mon->is_alive()) {
            exec();
            inflight++;
            while (inflight > thread_num) cv.wait(lck);
        }
    }

    void exec() {
	    transaction::run(pmpool, [&] {
            /* Data structure looks like below
            MEMBLOCK0(root) -> MEMBLOCK1 -> MEMBLOCK2 -> ...
                ||                 ||           ||
                \/                 \/           \/
              char[]              char[]       char[]
            */
            auto next_block_ptr = make_persistent<MEMBLOCK>();
            auto data_ptr = make_persistent<char[]>(block_size);
            block_ptr->value_ptr = data_ptr;
            block_ptr->size = block_size;
            block_ptr->next = next_block_ptr;
            block_ptr = next_block_ptr;

            /* To write something, just like doing to a memory pointer */
            char* data_in_mem_ptr = data_ptr.get();
            memset(data_in_mem_ptr, 'a', block_size);

            mon->incCommittedJobs();
            inflight--;
            cv.notify_all();
        });

    }
};
```

***

#### JAVA write benchmark codes using [llpl](https://github.com/xuechendi/llpl

``` bash
# compile with
javac -cp {$llpl_path}/llpl/target/classes:/usr/share/java/apache-commons-cli.jar examples/Writer.java
```

``` bash
# create a shortcut script
vim llpl_write_bench
#!/usr/bin/sh
java -ea -cp {$llpl_path}/llpl/target/classes:lib:target/test_classes:./:/usr/share/java/apache-commons-cli.jar -Djava.library.path={$llpl_path}/llpl/target/cppbuild {$llpl_path}/llpl/examples/Writer $@
```

``` bash
./llpl_write_bench -bs 2 -d /dev/dax0.0,/dev/dax1.0 -s 80 -t 1

usage: utility-name
 -bs,--block_size <arg>   block size for each request
 -d,--device <arg>        pmem device path
 -s,--size <arg>          input total data size(GB)
 -t,--thread_num <arg>    parallel threads number
```

#### llpl implementation

``` java
    synchronized MemoryBlock<Transactional> allocateMemory(long length) {
        return this.h.allocateMemoryBlock(Transactional.class, Integer.BYTES + length);
    }

    private void write() {
	int length = this.bytes.length;
	MemoryBlock<Transactional> mr = allocateMemory(length);
        mr.copyFromArray(this.bytes, 0, 0, length);
        this.monitor.incCommittedJobs();
    }

    public void run(String dev, int bs, long size, int thread_num) {
	    this.device = dev;
	    this.size = size;
	    this.thread_num = thread_num;
        System.out.println("Thread Num: " + this.thread_num + ", Data size: " + this.size + "MB, Device: " + dev);
        this.h = Heap.getHeap(dev, 1024*1024*1024L);
	    // multi write to aep for testing

        /*Console c = System.console();
        c.readLine("press Enter to start");*/
        
        bytes = new byte[bs * 1024 * 1024];
        Arrays.fill(this.bytes, (byte)'a');
       
        long total_jobs = this.size / bs;

	    long remained_jobs = total_jobs;


        System.out.println("Start to run, total jobs: " + total_jobs);
	    this.executor = Executors.newFixedThreadPool(this.thread_num);
	    while (remained_jobs > 0) {
          this.executor.submit(this::write);
	      remained_jobs -= 1;
	    }
    }

    public void wait_to_stop() {
	try {
	    this.executor.awaitTermination(60, TimeUnit.SECONDS);
	} catch (InterruptedException ie) {
        this.executor.shutdown();
	}
        System.out.println("Completed!");
    }

    public void stop() {
        this.executor.shutdown();
    }
```

***
#### completed version

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
#include <boost/program_options/options_description.hpp>
#include <boost/program_options/parsers.hpp>
#include <boost/program_options/variables_map.hpp>
#include <boost/program_options/cmdline.hpp>
#include <mutex>
#include <condition_variable>
#include <thread>


using pmem::obj::p;
using pmem::obj::persistent_ptr;
using pmem::obj::make_persistent;
using pmem::obj::transaction;
using pmem::obj::pool;
using namespace std;

struct MEMBLOCK{
    persistent_ptr<MEMBLOCK> next;
    persistent_ptr<char[]> value_ptr;
    p<size_t> size;
};

class ArgParser {
public:
    ArgParser(int ac, char* av[]) {
        boost::program_options::options_description options("options");
        options.add_options()
            ("help,h", "Print help messages")
            ("device,d", boost::program_options::value<string>(), "pmem device path")
            ("runtime,r", boost::program_options::value<string>(), "runtime")
            ("thread_num,t", boost::program_options::value<string>(), "parallel threads number")
            ("block_size,bs", boost::program_options::value<string>(), "block size for each request");
	    boost::program_options::store(boost::program_options::parse_command_line(ac, av, options), vm);
        if (vm.count("help")){ 
            std::cout << "Basic Command Line Parameter App" << std::endl 
                  << options << std::endl; 
            exit(1);
        } 
	    boost::program_options::notify(vm);
    }

    string get(string key) {
        if (vm.count(key)) {
            return vm[key].as<string>();
        }
        return ""; 
    }
private:
    boost::program_options::variables_map vm;

};

class Monitor {
public:
    Monitor(int runtime, int bs):
        committed_jobs(0),
        block_size(bs),
        alive(true) {
        run_thread = new thread(&Monitor::run, this);
    }

    ~Monitor() {
        delete run_thread;
    }

    void incCommittedJobs() {
        std::lock_guard<std::mutex> lock(committed_jobs_mutex);
        committed_jobs += 1;
    }

    bool is_alive() {
        return alive;
    }

    void stop() {
        alive = false;
        run_thread->join();
        elapse_sec -= 1;
        printf("======= Summarize =======\nAvg Bandwidth: %d (MB/s)\nAvg IOPS: %d\nTotal write data:%dMB\n", (committed_jobs * block_size / elapse_sec), (committed_jobs / elapse_sec), (committed_jobs * block_size));
    }

private:
    thread *run_thread;
    uint64_t committed_jobs;
    int block_size;
    std::mutex committed_jobs_mutex;
    bool alive;
	int elapse_sec = 0;

    void run() {
        long last_committed_jobs = 0;
        while (alive) {
            printf("Second %d (MB/s): %d\n", elapse_sec, (committed_jobs - last_committed_jobs) * block_size );
	        last_committed_jobs = committed_jobs;
	        elapse_sec += 1;
	        sleep(1);
	    }
    }

};

class Writer {
public:
    Writer(Monitor* mon, string dev, int bs, int thread_num):
        mon(mon),
        inflight(0),
        block_size(bs * 1024 * 1024),
        thread_num(thread_num) {
        /* Open and create in persistent memory device */
        printf("benchmark on %s, block size: %dMB, thread number: %d\n", dev.c_str(), bs, thread_num);
        //pmpool = pool<MEMBLOCK>::open(dev.c_str(), "");
        try {
            pmpool = pool<MEMBLOCK>::open(dev.c_str(), "");
        } catch (...) {
            pmpool = pool<MEMBLOCK>::create(dev.c_str(), "", 0, S_IRWXU);
        }
        block_ptr = pmpool.root();

        for (int i = 0; i < thread_num; i++) {
            thread_pool.push_back(thread(&Writer::run, this));
        }
    }

    ~Writer() {
        pmpool.close();
    }

    void stop() {
        for (auto it = thread_pool.begin(); it != thread_pool.end(); it++) {
            it->join();
        }
    }

private:
    vector<thread> thread_pool;
    pool<MEMBLOCK> pmpool;
    persistent_ptr<MEMBLOCK> block_ptr;
    uint64_t block_size;
    Monitor* mon;
    int thread_num;
    int inflight;
    std::mutex mtx;
    std::condition_variable cv;
    

    void run() {
        std::unique_lock<std::mutex> lck(mtx);
        while (mon->is_alive()) {
            exec();
            inflight++;
            while (inflight > thread_num) cv.wait(lck);
        }
    }

    void exec() {
	    transaction::run(pmpool, [&] {
            /* Data structure looks like below
            MEMBLOCK0(root) -> MEMBLOCK1 -> MEMBLOCK2 -> ...
                ||                 ||           ||
                \/                 \/           \/
              char[]              char[]       char[]
            */
            auto next_block_ptr = make_persistent<MEMBLOCK>();
            auto data_ptr = make_persistent<char[]>(block_size);
            block_ptr->value_ptr = data_ptr;
            block_ptr->size = block_size;
            block_ptr->next = next_block_ptr;
            block_ptr = next_block_ptr;

            /* To write something, just like doing to a memory pointer */
            char* data_in_mem_ptr = data_ptr.get();
            memset(data_in_mem_ptr, 'a', block_size);

            mon->incCommittedJobs();
            inflight--;
            cv.notify_all();
        });

    }

};

std::vector<std::string> split_string_to_vector(const string& s, char delimiter ) {
   std::vector<std::string> tokens;
   std::string token;
   std::istringstream tokenStream(s);
   while (std::getline(tokenStream, token, delimiter))
   {
      tokens.push_back(token);
   }
   return tokens;
}

int main(int argc, char* argv[]) {
    ArgParser arg_parser(argc, argv);
    int bs = stoi(arg_parser.get("block_size"));
    int thread_num = stoi(arg_parser.get("thread_num"));
    int runtime = stoi(arg_parser.get("runtime"));
    vector<string> device_list = split_string_to_vector(arg_parser.get("device"), ',');

    Monitor monitor(runtime, bs);
    vector<Writer*> writer_list;
    for (int i = 0; i < device_list.size(); i++) {
        writer_list.push_back(new Writer(&monitor, device_list[i], bs, thread_num));
    }
    sleep(runtime);
    monitor.stop();
    for (int i = 0; i < device_list.size(); i++) {
        writer_list[i]->stop();
        delete writer_list[i];
    }
    exit(0);
}
```

***


#### JAVA write benchmark codes using [llpl](https://github.com/xuechendi/llpl

``` bash
# compile with
javac -cp {$llpl_path}/llpl/target/classes:/usr/share/java/apache-commons-cli.jar examples/Writer.java
```

``` bash
# create a shortcut script
vim llpl_write_bench
#!/usr/bin/sh
java -ea -cp {$llpl_path}/llpl/target/classes:lib:target/test_classes:./:/usr/share/java/apache-commons-cli.jar -Djava.library.path={$llpl_path}/llpl/target/cppbuild {$llpl_path}/llpl/examples/Writer $@
```

``` bash
./llpl_write_bench -bs 2 -d /dev/dax0.0,/dev/dax1.0 -s 80 -t 1

usage: utility-name
 -bs,--block_size <arg>   block size for each request
 -d,--device <arg>        pmem device path
 -s,--size <arg>          input total data size(GB)
 -t,--thread_num <arg>    parallel threads number
```

``` java
/* 
 * Copyright (C) 2018 Intel Corporation
 *
 * SPDX-License-Identifier: BSD-3-Clause
 * 
 */

package examples;

import lib.llpl.*;
import java.util.Arrays;
import java.util.concurrent.*;
import org.apache.commons.cli.*;


class ArgParser {

    CommandLine cmd;
    Options options = new Options();
    CommandLineParser parser = new DefaultParser();
    HelpFormatter formatter = new HelpFormatter();

    ArgParser (String[] args) {

        Option device = new Option("d", "device", true, "pmem device path");
        device.setRequired(true);
        options.addOption(device);

        Option size = new Option("s", "size", true, "input total data size(GB)");
        size.setRequired(true);
        options.addOption(size);

        Option thread_num = new Option("t", "thread_num", true, "parallel threads number");
        thread_num.setRequired(true);
        options.addOption(thread_num);

        Option block_size = new Option("bs", "block_size", true, "block size for each request");
        block_size.setRequired(true);
        options.addOption(block_size);

        try {
            this.cmd = parser.parse(options, args);
        } catch (ParseException e) {
            System.out.println(e.getMessage());
            formatter.printHelp("utility-name", options);
            System.exit(1);
        }

    }

    public String get(String key) {
	String ret = "";
    ret = this.cmd.getOptionValue(key);
	return ret;
    }
}

class Monitor {
    long committedJobs = 0;
    boolean alive = true;
    int bs;
    ExecutorService monitor_thread;
	Monitor (int bs) {
        this.bs = bs;
	    this.monitor_thread = Executors.newFixedThreadPool(1);
        this.monitor_thread.submit(this::run);
	}

	void run () {
        long last_committed_jobs = 0;
	    int elapse_sec = 0;
        while(alive) {
            System.out.println("Second " + elapse_sec + "(MB/s): " + (this.committedJobs - last_committed_jobs) * this.bs );
	        last_committed_jobs = this.committedJobs;
	        elapse_sec += 1;
	        try {
	            Thread.sleep(1000);
            } catch (InterruptedException e) {
                System.exit(1);
	        }
	    }
    }

    synchronized void incCommittedJobs() {
        this.committedJobs += 1;
    }

	void stop() {
	    this.alive = false;
	    this.monitor_thread.shutdown();
	}
}

public class Writer {
    Heap h = null;
    String device;
    long size;
    int thread_num;
    byte[] bytes;
    ExecutorService executor;
    Monitor monitor;

    Writer (Monitor monitor) {
        this.monitor = monitor;
    }


    synchronized MemoryBlock<Transactional> allocateMemory(long length) {
    //MemoryBlock<Transactional> allocateMemory(long length) {
        return this.h.allocateMemoryBlock(Transactional.class, Integer.BYTES + length);
    }

    private void write() {
	int length = this.bytes.length;
	MemoryBlock<Transactional> mr = allocateMemory(length);
        mr.copyFromArray(this.bytes, 0, 0, length);
        this.monitor.incCommittedJobs();
    }


    public void run(String dev, int bs, long size, int thread_num) {
	this.device = dev;
	this.size = size;
	this.thread_num = thread_num;
        System.out.println("Thread Num: " + this.thread_num + ", Data size: " + this.size + "MB, Device: " + dev);
        this.h = Heap.getHeap(dev, 1024*1024*1024L);
	    // multi write to aep for testing

        /*Console c = System.console();
        c.readLine("press Enter to start");*/
        
        bytes = new byte[bs * 1024 * 1024];
        Arrays.fill(this.bytes, (byte)'a');
       
        long total_jobs = this.size / bs;

	    long remained_jobs = total_jobs;


        System.out.println("Start to run, total jobs: " + total_jobs);
	    this.executor = Executors.newFixedThreadPool(this.thread_num);
	    while (remained_jobs > 0) {
          this.executor.submit(this::write);
	      remained_jobs -= 1;
	    }
    }

    public void wait_to_stop() {
	try {
	    this.executor.awaitTermination(60, TimeUnit.SECONDS);
	} catch (InterruptedException ie) {
        this.executor.shutdown();
	}
        System.out.println("Completed!");
    }

    public void stop() {
        this.executor.shutdown();
    }


    public static void main(String[] args) {
        //String[] device_list = {"/dev/dax0.0", "/dev/dax0.1", "/dev/dax0.2", "/dev/dax0.3", "/dev/dax0.5","/dev/dax1.0", "/dev/dax1.1", "/dev/dax1.2", "/dev/dax1.3", "/dev/dax1.5"};
        ArgParser arg_parser = new ArgParser(args);
        String[] device_list = arg_parser.get("device").trim().split("\\s*,\\s*", -1);
        long size = Integer.parseInt(arg_parser.get("size")) * 1024;
        int thread_num = Integer.parseInt(arg_parser.get("thread_num"));
        int bs = Integer.parseInt(arg_parser.get("block_size"));
        
        Writer[] writer = new Writer[device_list.length];
        Monitor monitor = new Monitor(bs);
        for (int i = 0; i < device_list.length; i++) { 
            writer[i] = new Writer(monitor);
            writer[i].run(device_list[i], bs, size, thread_num);
        }
        writer[0].wait_to_stop();
        for (int i = 1; i < device_list.length; i++) { 
            writer[i].stop();
        }
        monitor.stop();
        System.exit(0);
    }
}
```