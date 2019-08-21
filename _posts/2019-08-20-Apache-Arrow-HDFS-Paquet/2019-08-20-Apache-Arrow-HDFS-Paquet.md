---
layout: post
title: "Apache Arrow enabling HDFS Parquet support"
date: 2019-08-20
categories: [Spark, Arrow]
abstract: "Enable Apache Arrow with HDFS and Parquet support, and continually implement a new java interface for loading parquet from hdfs."
abstract_img: ""
---

First Arrow building from source blog refer to here: [link](/2019/07/12/Apache-Arrow-Gandiva-on-LLVM)

install double-conversion
``` bash
git clone https://github.com/google/double-conversion.git
cd double-conversion
mkdir build
cd build
cmake -DBUILD_SHARED_LIBS=ON ..
make
make install
```


apache arrow and gandiva
``` bash
cd arrow/cpp/build
rm -rf *
cmake -DARROW_GANDIVA_JAVA=ON -DARROW_GANDIVA=ON -DARROW_PARQUET=ON -DARROW_HDFS=ON -DARROW_BOOST_USE_SHARED=ON ..
# I noticed that even when we saw succeed of above cmake procedure, there will be some error inside "CMakeFiles/CMakeError.log", those errors are not fatal. So if you failed in building, you should keep looking the issue on foreground terminal log instead of the "CMakeFiles/CMakeError.log"
make
make install
```




