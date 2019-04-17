---
layout: post
title: "TensorFlowOnSpark: Install Tutorial Step by Step (spark on Yarn)"
date: 2019-04-16
categories: [Spark]
abstract: "TensorFlowOnSpark installation and verification step by step."
abstract_img: ""
---

### references:
[Yahoo TensorFlowOnSpark Repo guide](https://github.com/yahoo/TensorFlowOnSpark/wiki/GetStarted_YARN)
<BR>
[Tensorflow Spark Connector](https://github.com/tensorflow/ecosystem/tree/master/spark/spark-tensorflow-connector)

***
### Create a directory for later on scripts and package

``` bash
mkdir tensorflowonspark
cd tensorflowonspark
```

### Install Tensorflow and Tensorflow on spark

I tried to use python2.7 running tensorflowonspark, and it failed in importing tensorflow package when spark-submit pyspark scipt. While if I changed to python3, it works.
So, if you don't have a strong reason of using python2.7, just use python3 here.

``` bash
pip3 install tensorflow tensorflowonspark
```

### Prepare spark and Hadoop

I already installed spark and hadoop(Yarn, HDFS), and if you need some guidance, please check [Spark and Hadoop build from source](spark-and-hadoop-build-from-source)

### Install Tensorflow Spark Connector

If you want to use format "TFRecords" to input and output on HDFS, below preparation is necessary.

``` bash
git clone https://github.com/tensorflow/ecosystem.git
cd ecosystem/hadoop
mvn clean install -DskipTests
cd ../spark/spark-tensorflow-connector
mvn clean install -DskipTests
```

Then you'll have tensorflow-hadoop and tensorflow-spark-connector in mvn repo

``` bash
ll /root/.m2/repository/org/tensorflow/
total 0
drwxr-xr-x 3 root root 20 Apr 17 09:07 parentpom
drwxr-xr-x 3 root root 20 Apr 17 09:07 proto
drwxr-xr-x 3 root root 52 Apr 17 09:19 spark-tensorflow-connector_2.11
drwxr-xr-x 3 root root 52 Apr 17 09:09 tensorflow-hadoop
```

Upload the jar to HDFS

``` bash
hadoop fs -put target/tensorflow-hadoop-1.10.0.jar
```

### Prepare TensorFlow on Spark zip, so training pyspark script could call.

``` bash
git clone https://github.com/yahoo/TensorFlowOnSpark.git
cd TensorFlowOnSpark
zip -r tfspark.zip tensorflowonspark
cd ..
```

### Prepare HDFS native lib (libhdfs.so)

You probably should generated it when building Hadoop from source code, and if you didn't, check below

``` bash
cd ${HADOOP_SOURCEC_CODE}/hadoop-hdfs-project
mvn install -Pdist,native -DskipTests -Dtar
find ./ -name libhdfs.so
./hadoop-hdfs-native-client/target/target/usr/local/lib/libhdfs.so 
```

### Prepare MNIST example package

``` bash
mkdir mnist
cd mnist
curl -O "http://yann.lecun.com/exdb/mnist/train-images-idx3-ubyte.gz"
curl -O "http://yann.lecun.com/exdb/mnist/train-labels-idx1-ubyte.gz"
curl -O "http://yann.lecun.com/exdb/mnist/t10k-images-idx3-ubyte.gz"
curl -O "http://yann.lecun.com/exdb/mnist/t10k-labels-idx1-ubyte.gz"
zip -r mnist.zip *
cd ..
```

### Run MNIST preparation/tranining/inference on TensorFlowOnSpark

System Variables Configuration

``` bash
export PYSPARK_PYTHON=/usr/bin/python3
export SPARK_YARN_USER_ENV="PYSPARK_PYTHON=/usr/bin/python3"
export QUEUE=default  # For CPU
#export QUEUE=gpu     # For GPU

find / -name libhdfs.so
/mnt/nvme2/chendi/hadoop/hadoop-hdfs-project/hadoop-hdfs-native-client/target/target/usr/local/lib/libhdfs.so
find / -name libjvm.so
/usr/java/jdk1.8.0_201-amd64/jre/lib/amd64/server/libjvm.so

export LIB_HDFS=${libhdfs.so location directory}  #/mnt/nvme2/chendi/hadoop/hadoop-hdfs-project/hadoop-hdfs-native-client/target/target/usr/local/lib/
export LIB_JVM=${libjvm.so location directory}   #/usr/java/jdk1.8.0_201-amd64/jre/lib/amd64/server/
#export LIB_CUDA=/usr/local/cuda-7.5/lib64   #libcuda.so path
``` 

Prepare data as TFRecords(CPU mode)

Notice here:
When using file path as hdfs:/// the package should be pre-uploaded to hdfs, and hdfs:/// will be translate as hdfs://${ip}:${port}/

``` bash
${SPARK_HOME}/bin/spark-submit \
--master yarn \
--deploy-mode cluster \
--queue default \
--num-executors 4 \
--executor-memory 4G \
--archives hdfs:///user/${USER}/Python.zip#Python,mnist/mnist.zip#mnist \
--jars hdfs:///user/${USER}/tensorflow-hadoop-1.0-SNAPSHOT.jar \
TensorFlowOnSpark/examples/mnist/mnist_data_setup.py \
--output mnist/tfr \
--format tfr
```

Prepare data as TFRecords(GPU mode)

``` bash
${SPARK_HOME}/bin/spark-submit \
--master yarn \
--deploy-mode cluster \
--queue default \
--num-executors 4 \
--executor-memory 4G \
--archives hdfs:///user/${USER}/Python.zip#Python,mnist/mnist.zip#mnist \
--jars hdfs:///user/${USER}/tensorflow-hadoop-1.0-SNAPSHOT.jar \
--conf spark.executorEnv.LD_LIBRARY_PATH=$LIB_CUDA \
--driver-library-path=$LIB_CUDA \
TensorFlowOnSpark/examples/mnist/mnist_data_setup.py \
--output mnist/tfr \
--format tfr
```

Verification

Check on Spark UI
![Spark-UI-Screenshot](/static/img/2019-04-17-build-tensorflow-on-spark-env/spark-ui.jpg)

``` bash
hdfs dfs -ls mnist
Found 2 items
drwxr-xr-x   - root supergroup          0 2019-04-17 14:01 mnist/tfr
```

---

Till now, we can think the TensorFlowOnSpark setup is basically done and verified.
And then we can turn to run some real benchmark.
