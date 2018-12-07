---
layout: post
title: "Step by step to deploy spark on kubernetes and running examples"
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

***