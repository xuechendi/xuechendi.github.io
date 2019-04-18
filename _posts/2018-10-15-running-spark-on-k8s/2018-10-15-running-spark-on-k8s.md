---
layout: post
title: "Running Spark on kubernetes Step by steps"
date: 2018-10-18
categories: [kubernetes devop, Hadoop/spark devop]
abstract: "I will cover how to deploy spark on kubernetes and how to run spark examples including simplest example like calculating pi, examples required input/output through HDFS and examples with Hive."
---

#### DEPLOYMENT ####

This blog is practised on CentOS 7, [ubuntu reference](https://www.digitalocean.com/community/tutorials/how-to-create-a-kubernetes-1-10-cluster-using-kubeadm-on-ubuntu-16-04)

* Pre-Setup

Upgrade kernel to latest version.

``` bash
$ yum upgrade -y
$ reboot
```

``` bash
setenforce 0
sed -i --follow-symlinks 's/SELINUX=enforcing/SELINUX=disabled/g' /etc/sysconfig/selinux
modprobe br_netfilter
echo '1' > /proc/sys/net/bridge/bridge-nf-call-iptables
```

* Docker and Kubeadm installation

``` bash
vim /etc/yum.repos.d/kubernetes.repo
[kubernetes]
name=Kubernetes
baseurl=https://packages.cloud.google.com/yum/repos/kubernetes-el7-x86_64
enabled=1
gpgcheck=1
repo_gpgcheck=1
gpgkey=https://packages.cloud.google.com/yum/doc/yum-key.gpg
        https://packages.cloud.google.com/yum/doc/rpm-package-key.gpg
```

``` bash
yum update
yum install kubeadm docker –y
```

``` bash
systemctl restart docker && systemctl enable docker
systemctl restart kubelet && systemctl enable kubelet
```

[optional] some configuration to set proxy and no proxy
``` bash
sudo mkdir -p /etc/systemd/system/docker.service.d
vim /etc/systemd/system/docker.service.d/http-proxy.conf
[Service]
Environment="HTTP_PROXY=${proxy}" "NO_PROXY=${no_proxy}"

vim /etc/systemd/system/docker.service.d/https-proxy.conf
[Service]
Environment="HTTPS_PROXY=${proxy}" "NO_PROXY=${no_proxy}"

systemctl daemon-reload
systemctl restart docker
```

* Kubernetes nodes create and join

``` bash
swapoff –a

kubeadm init --pod-network-cidr=10.244.0.0/16 --feature-gates=CoreDNS=false --apiserver-advertise-address=10.1.0.35 --kubernetes-version=v1.11.0
# if kubeadm init failed, use “kubeadm reset && systemctl restart kubelet” to rerun

# if init completed, set permission and check status 
mkdir ~/.kube/
chmod +755 ~/.kube
cp /etc/kubernetes/admin.conf ~/.kube/config
chown $(id -u):$(id -g) $HOME/.kube/config
```

Set up pod flannel networks
``` bash
kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/v0.9.1/Documentation/kube-flannel.yml

$ kubectl get nodes
NAME        STATUS     ROLES     AGE       VERSION
bigdata09   Ready   master    6m        v1.10.3
```

for kubernetes slave nodes, use below command to join
``` bash
kubeadm join 192.168.5.9:6443 --token ${provide_by_} --discovery-token-ca-cert-hash sha256:5a549c8e6c1f0e76e96c86b516e830be454a024360c05c08e196ba9bc971284d
```

* spark docker img preparation

In order to run spark benchmark tool [HiBench](https://github.com/Intel-bigdata/HiBench), I also added HiBench jar and configuration inside Spark Docker Img

``` bash
vim /hadoop/spark/kubernetes/dockerfiles/spark/Dockerfile
# add below lines in Dockerfile
# to copy spark configuration with hibench configuration and jars to the img
COPY HiBench/sparkbench /opt/HiBench/sparkbench
COPY sparkbench.conf /opt/HiBench/sparkbench.conf
# set the configuration path to docker system variable.
RUN echo SPARKBENCH_PROPERTIES_FILES=/opt/HiBench/sparkbench.conf >> /root/.bashrc
ENV SPARKBENCH_PROPERTIES_FILES /opt/HiBench/sparkbench.conf

#Notes: sparkbench.conf is a HiBench generated conf from HiBench.conf
#Sparkbench folder is the one under HiBench contains all SparkBench jars.

$ ./bin/docker-image-tool.sh -r docker.io/xuechendi -t v2.3.0-with-hibench build
$ ./bin/docker-image-tool.sh -r docker.io/xuechendi -t v2.3.0-with-hibench push
```

* Run spark benchmark terasort in Kubenetes pods.

``` bash
spark-submit --master k8s://https://10.1.0.35:6443 --deploy-mode cluster --properties-file /HiBench/report/terasort/spark/conf/sparkbench/spark.conf --class com.intel.hibench.sparkbench.micro.ScalaTeraSort --spark.executor.instances 25 --executor-memory 17g --conf spark.kubernetes.driver.pod.name=spark-terasort --conf spark.kubernetes.container.image=xuechendi/spark:v2.3.0-with-hibench --conf spark.kubernetes.authenticate.driver.serviceAccountName=spark  local:///opt/HiBench/sparkbench/assembly/target/sparkbench-assembly-7.1-SNAPSHOT-dist.jar "hdfs://10.1.0.35:8020/HiBench/Terasort/Input" "hdfs://10.1.0.35:8020/HiBench/Terasort/Output"
``` 

local:// refers to the location inside container.

* Run Spark Sql benchmark in Kubernetes pods.

We will also put our application inside HiBench jar.

``` scala
package com.intel.hibench.sparkbench.sql
import org.apache.spark.sql.SparkSession
import org.apache.spark.sql.hive.HiveContext
object ScalaSparkSQLBench{
  def main(args: Array[String]){
    if (args.length < 2){
      System.err.println(
        s"Usage: $ScalaSparkSQLBench <workload name> <SQL sciprt file>"
      )
      System.exit(1)
    }
    val workload_name = args(0)
    val sql_file = args(1)
	// Configure Hive Context inline
    val spark = SparkSession.builder()
    .config("spark.sql.warehouse.dir","hdfs://10.1.0.35:8020/Hive")
    .config("javax.jdo.option.ConnectionURL","jdbc:mysql://10.1.0.35:3306/metastore")
    .config("javax.jdo.option.ConnectionDriverName","com.mysql.jdbc.Driver")
    .config("javax.jdo.option.ConnectionUserName","hive")
    .config("javax.jdo.option.ConnectionPassword","password")
    .config("hive.vectorized.execution.enabled","true")
    .config("hive.vectorized.execution.reduce.enabled","true")
    .config("hive.metastore.warehouse.dir","hdfs://10.1.0.35:8020/Hive")
    .config("hive.exec.scratchdir","hdfs://10.1.0.35:8020/Hive")
    .config("hive.metastore.schema.verification","false")
    .enableHiveSupport()
    .getOrCreate()
    val hc = new HiveContext(spark.sparkContext)

    val _sql = scala.io.Source.fromFile(sql_file).mkString
    _sql.split(';').foreach { x =>
      if (x.trim.nonEmpty)
        hc.sql(x).collect()
}
```

Compile scala codes with "mvn package" and Build a new docker img with this new jar.

``` bash
spark-submit --master k8s://https://10.1.0.35:6443 --deploy-mode cluster --properties-file /hadoop/spark/spark.conf --class com.intel.hibench.sparkbench.sql.ScalaSparkSQLBench --num-executors 25 --executor-cores 6 --executor-memory 17g --conf spark.kubernetes.driver.pod.name=spark-sql-tpcds --conf spark.kubernetes.container.image=xuechendi/spark/spark:v2.3.0-with-spark-sql --conf spark.kubernetes.authenticate.driver.serviceAccountName=spark local:///opt/HiBench/sparkbench/assembly/target/sparkbench-assembly-7.1-SNAPSHOT-dist.jar Spark-sql-on-k8s /opt/UC11_K8S/$query_id
```

* Optimization spark in kube performance by mounting a faster media device to container

``` bash
echo "spark.local.dir /tmp/" >> spark-defaults.conf #so spark will use /tmp as its shuffle & spill directory
echo "VOLUME /tmp" >> Dockerfile #this configuration will tell run-time container to use /var/lib/docker/volumes for /tmp dir inside container.
```

* Debug and check

``` bash
docker ps
CONTAINER ID        IMAGE                        COMMAND                  CREATED             STATUS              PORTS               NAMES
844ab90bcfb8        71f3e1f14cb6                 "/opt/entrypoint.s..."   4 minutes ago       Up 4 minutes                            k8s_executor_com-intel-hibench-sparkbench-micro-scalaterasort-3ed74fbe8cf935e9a34dfebb8baafbfa-exec-5_d
$ docker inspect 844ab90bcfb8
"Mounts": [
            {
                "Type": "bind",
                "Source": "/var/lib/kubelet/pods/346e134d-8579-11e8-b100-001e677c4f1a/etc-hosts",
                "Destination": "/etc/hosts",
                "Mode": "",
				...

```

One way I did to debug a spark kube is add a sleep in dockerfile, so once the spark executor pod is up, it won't die too quickly if this executor hit some error because of the sleep cmdline.

``` bash
kubectl exec -it ${podname} -- /bin/bash
# this helps to get into the pod for some checking.
``` 