---
layout: post
title: "Persisten Memory Development Kit(PMDK) Notes 1: How to install"
date: 2018-10-10
categories: [PMDK]
abstract: "PMDK is super cool, if you missed the introduction, please go to <a href='/2018/10/10/PMDK-Tutorial-0-What-it-is'>PMDK Notes 0: what it is and quick examples</a> to have a ramp up. For this blog, I wrote down all my steps to build up a PMDK with its c++ api and java api in my Centos 7.3 system."
abstract_img: ""
---

***

This blog records all my steps of building PMDK, PMDK C++ API(libpmemobj++), PMDK JAVA API(llpl) on Centos 7.3.
If you want to have a rampup of what PMDK is, and how it works, please refer to [PMDK Notes 0: what it is and quick examples](/2018/10/10/PMDK-Tutorial-0-What-it-is)

***

#### PMDK Installation [github page](https://github.com/pmem/pmdk) ####

step1: PREREQUISITES TO BUILD
* autoconf

``` bash
yum install -y autoconf
```

* pkg-configure

``` bash
yum groupinstall -y "Development Tools"
```

* libndctl-devel (v60.1 or later), libdaxctl-devel (v60.1 or later), ndctl (v60.1 or later)

``` bash
git clone https://github.com/pmem/ndctl.git
cd ndctl
git checkout v63

yum install -y acsciidoctor
yum install -y kmod-devel.x86_64
yum install -y libudev-devel
yum install -y libuuid-devel
yum install -y json-c-devel
yum install -y jemalloc-devel

./autogen.sh
./configure CFLAGS='-g -O2' --prefix=/usr --sysconfdir=/etc --libdir=/usr/lib64
make -j
make check
make install
cd ..
```

step2: PMDK INSTALLATION
```
git clone https://github.com/pmem/pmdk.git
cd pmdk
git checkout tags/1.4.2
make -j
make install
export PKG_CONFIG_PATH=/usr/local/lib64/pkgconfig/:$PKG_CONFIG_PATH
cd ..
```

***

#### libpmemobj++ Installation [github page](https://github.com/pmem/libpmemobj-cpp) ####
srep1: PREREQUISITES TO BUILD
* cmake >= 3.3 [official site](https://cmake.org/install/)

``` bash
wget https://cmake.org/files/v3.13/cmake-3.13.0-rc1.tar.gz
tar zxf cmake-3.13.0-rc1.tar.gz
cd cmake-3.13.0-rc1/
./bootstrap
make -j
make install
cd ..

cmake --version
cmake version 3.13.0-rc1
CMake suite maintained and supported by Kitware (kitware.com/cmake).
```

* upgrade gcc/g++ to 5.3

``` bash
sudo yum install -y centos-release-scl
sudo yum install devtoolset-4-gcc*
scl enable devtoolset-4 bash
gcc --version
```

* Persistent Memory Development Kit (PMDK)

step2: COMPILE Libpmemobj++

```
git clone https://github.com/pmem/libpmemobj-cpp.git
cd libpmemobj-cpp/
git checkout 1.5-rc1
mkdir build
cd build
cmake ..
make -j
make install
cd ../..
```

* Some may happen issue fixing

``` bash
-- Checking for module 'libpmemobj>=1.4'
--   No package 'libpmemobj' found

export PKG_CONFIG_PATH=/usr/local/lib64/pkgconfig/:$PKG_CONFIG_PATH
```


***

#### llpl(Low Level Persistence Library)JAVA Lib Installation [github page](https://github.com/pmem/llpl) ####
step1: PREREQUISITES TO BUILD
* Persistent Memory Development Kit (PMDK)
* Java 8 or above

``` bash
java -version
java version "1.8.0_171"
Java(TM) SE Runtime Environment (build 1.8.0_171-b11)
Java HotSpot(TM) 64-Bit Server VM (build 25.171-b11, mixed mode)
```

* Build tools - g++ compiler and make

``` bash
g++ -v
Using built-in specs.
COLLECT_GCC=g++
COLLECT_LTO_WRAPPER=/usr/libexec/gcc/x86_64-redhat-linux/4.8.5/lto-wrapper
Target: x86_64-redhat-linux
Configured with: ../configure --prefix=/usr --mandir=/usr/share/man --infodir=/usr/share/info --with-bugurl=http://bugzilla.redhat.com/bugzilla --enable-bootstrap --enable-shared --enable-threads=posix --enable-checking=release --with-system-zlib --enable-__cxa_atexit --disable-libunwind-exceptions --enable-gnu-unique-object --enable-linker-build-id --with-linker-hash-style=gnu --enable-languages=c,c++,objc,obj-c++,java,fortran,ada,go,lto --enable-plugin --enable-initfini-array --disable-libgcj --with-isl=/builddir/build/BUILD/gcc-4.8.5-20150702/obj-x86_64-redhat-linux/isl-install --with-cloog=/builddir/build/BUILD/gcc-4.8.5-20150702/obj-x86_64-redhat-linux/cloog-install --enable-gnu-indirect-function --with-tune=generic --with-arch_32=x86-64 --build=x86_64-redhat-linux
Thread model: posix
gcc version 4.8.5 20150623 (Red Hat 4.8.5-28) (GCC)
```

step2: BUILD AND RUN
* compile

``` bash
git clone https://github.com/pmem/llpl.git
cd llpl/
make -j
```

* mount a EMULATING PERSISTENT MEMORY or PERSISTENT MEMORY and run tests

``` bash
mkdir -p /mnt/mem
mount -t tmpfs -o size=4G tmpfs /mnt/mem
chmod -R a+rw /mnt/mem
make tests
cd ..
```
