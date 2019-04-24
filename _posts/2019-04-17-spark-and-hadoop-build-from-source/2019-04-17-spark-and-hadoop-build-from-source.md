---
layout: post
title: "Spark and Hadoop build from Source"
date: 2019-04-16
categories: [Spark]
abstract: "Spark is using 3.0.0(master of Apr 2019), Hadoop is using 3.2.0(claimed to be supported in spark pom.xml)"
abstract_img: ""
---

### Hadoop building from source

``` bash
git clone https://github.com/apache/hadoop.git
cd hadoop
git checkout rel/release-3.2.0
# only build binary for hadoop
mvn clean install -Pdist -DskipTests -Dtar
# build binary and native library such as libhdfs.so for hadoop
# mvn clean install -Pdist,native -DskipTests -Dtar
```

Using mvn install, compiled hadoop jar will be put into /root/.m2/repository/ for other projects depends on hadoop to use. Check below pic, now, we have hadoop-3.2.0 installed and can be used by continuelly spark compiling.

![apache_arrow_intro_1](/static/img/2019-04-17-spark-and-hadoop-build-from-source/m2_hadoop_list.jpg)

To run hadoop, binary path is /hadoop/hadoop-dist/target/hadoop-3.2.0/

``` bash
export HADOOP_HOME=/mnt/nvme2/chendi/hadoop/hadoop-dist/target/hadoop-3.2.0/
```

### [Spark building from source](https://spark.apache.org/docs/latest/building-spark.html)
``` bash
git clone https://github.com/apache/spark.git
cd spark
# check spark supported hadoop version
grep \<hadoop\.version\> -r pom.xml
    <hadoop.version>2.7.4</hadoop.version>
    <hadoop.version>3.2.0</hadoop.version>
# so we should build spark specifying hadoop version as 3.2
./build/mvn -Pyarn -Phadoop-3.2 -Dhadoop.version=3.2.0 -DskipTests clean package
# we can use package here since there is no following package depends on spark, other wise, also use install here.
```

Specify SPARK_HOME to spark path

### Tips

use -o option when executing mvn to avoid online package update or installation.

``` bash
./build/mvn -Pyarn -Phadoop-3.2 -Dhadoop.version=3.2.0 -DskipTests clean package -o
```

pre install requirements to mvn repo -- /root/.m2/repository to avoid slow mvn downloading.





