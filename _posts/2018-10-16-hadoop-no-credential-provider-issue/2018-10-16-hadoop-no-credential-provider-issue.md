---
layout: post
title: "[Solved]Hadoop no credential provider issue with Ceph as object store(hadoop 3.1.1)"
date: 2018-10-17
categories: [Hadoop/spark devop]
abstract: "I met no credential provider issue after upgrading my hadoop to 3.1.1 with hive 3.1.0, since it took quite a while to find a solution, hope others may benefit from my findings"
---
<br>

#### BACKGROUND ####
I saw this issue when I upgrade my hadoop to 3.1.1 and my hive to 3.1.0. Didn't see in hadoop 2.8.5.

I used ceph with ceph radosgw as a replacement to HDFS. Using S3A interface, so it will call some codes in AWSCredentialProviderList.java for a credential checking.

I provided aws s3a.access.key and s3a.secret.key in hadoop core-site.xml, and set defaultFS to s3a://buckets, in that case, it worked fine to run a hadoop mapreduce job and input/output data to s3a.

Also when I can use below command line to manage data in s3a://buckets.
```
hdfs dfs -ls /
```

<br>
While when I used hive, any metadata operations like create/drop databases/tables worked fine. But when hive scheduled a mapreduce job and connecting with yarn, yarn failed in the credential checking process.

***

#### ERROR LOG ####

```
2018-10-16 20:28:45,462 INFO [main] org.apache.hadoop.service.AbstractService: Service org.apache.hadoop.mapreduce.v2.app.MRAppMaster failed in state INITED
org.apache.hadoop.yarn.exceptions.YarnRuntimeException: Error while initializing
        at org.apache.hadoop.mapreduce.v2.app.MRAppMaster.serviceInit(MRAppMaster.java:368)
        at org.apache.hadoop.service.AbstractService.init(AbstractService.java:164)
        at org.apache.hadoop.mapreduce.v2.app.MRAppMaster$6.run(MRAppMaster.java:1760)
        at java.security.AccessController.doPrivileged(Native Method)
        at javax.security.auth.Subject.doAs(Subject.java:422)
        at org.apache.hadoop.security.UserGroupInformation.doAs(UserGroupInformation.java:1729)
        at org.apache.hadoop.mapreduce.v2.app.MRAppMaster.initAndStartAppMaster(MRAppMaster.java:1757)
        at org.apache.hadoop.mapreduce.v2.app.MRAppMaster.main(MRAppMaster.java:1691)
Caused by: java.net.SocketTimeoutException: doesBucketExist on tpcds: com.amazonaws.AmazonClientException: No AWS Credentials provided by BasicAWSCredentialsProvider EnvironmentVariableCredentialsProvider InstanceProfileCredentialsProvider : com.amazonaws.SdkClientException: Unable to load credentials from service endpoint
        at org.apache.hadoop.fs.s3a.S3AUtils.translateInterruptedException(S3AUtils.java:330)
        at org.apache.hadoop.fs.s3a.S3AUtils.translateException(S3AUtils.java:171)
        at org.apache.hadoop.fs.s3a.Invoker.once(Invoker.java:111)
        at org.apache.hadoop.fs.s3a.Invoker.lambda$retry$3(Invoker.java:260)
        at org.apache.hadoop.fs.s3a.Invoker.retryUntranslated(Invoker.java:317)
        at org.apache.hadoop.fs.s3a.Invoker.retry(Invoker.java:256)
        at org.apache.hadoop.fs.s3a.Invoker.retry(Invoker.java:231)
        at org.apache.hadoop.fs.s3a.S3AFileSystem.verifyBucketExists(S3AFileSystem.java:372)
        at org.apache.hadoop.fs.s3a.S3AFileSystem.initialize(S3AFileSystem.java:308)
        at org.apache.hadoop.fs.FileSystem.createFileSystem(FileSystem.java:3354)
        at org.apache.hadoop.fs.FileSystem.access$200(FileSystem.java:124)
        at org.apache.hadoop.fs.FileSystem$Cache.getInternal(FileSystem.java:3403)
        at org.apache.hadoop.fs.FileSystem$Cache.get(FileSystem.java:3371)
        at org.apache.hadoop.fs.FileSystem.get(FileSystem.java:477)
        at org.apache.hadoop.fs.FileSystem.get(FileSystem.java:226)
        at org.apache.hadoop.mapreduce.v2.app.MRAppMaster.getFileSystem(MRAppMaster.java:605)
        at org.apache.hadoop.mapreduce.v2.app.MRAppMaster.serviceInit(MRAppMaster.java:315)
        ... 7 more
Caused by: com.amazonaws.AmazonClientException: No AWS Credentials provided by BasicAWSCredentialsProvider EnvironmentVariableCredentialsProvider InstanceProfileCredentialsProvider : com.amazonaws.SdkClientException: Unable to load credentials from service endpoint
        at org.apache.hadoop.fs.s3a.AWSCredentialProviderList.getCredentials(AWSCredentialProviderList.java:139)
        at com.amazonaws.http.AmazonHttpClient$RequestExecutor.getCredentialsFromContext(AmazonHttpClient.java:1164)
        at com.amazonaws.http.AmazonHttpClient$RequestExecutor.runBeforeRequestHandlers(AmazonHttpClient.java:762)
        at com.amazonaws.http.AmazonHttpClient$RequestExecutor.doExecute(AmazonHttpClient.java:724)
        at com.amazonaws.http.AmazonHttpClient$RequestExecutor.executeWithTimer(AmazonHttpClient.java:717)
        at com.amazonaws.http.AmazonHttpClient$RequestExecutor.execute(AmazonHttpClient.java:699)
        at com.amazonaws.http.AmazonHttpClient$RequestExecutor.access$500(AmazonHttpClient.java:667)
        at com.amazonaws.http.AmazonHttpClient$RequestExecutionBuilderImpl.execute(AmazonHttpClient.java:649)
        at com.amazonaws.http.AmazonHttpClient.execute(AmazonHttpClient.java:513)
        at com.amazonaws.services.s3.AmazonS3Client.invoke(AmazonS3Client.java:4325)
        at com.amazonaws.services.s3.AmazonS3Client.invoke(AmazonS3Client.java:4272)
        at com.amazonaws.services.s3.AmazonS3Client.headBucket(AmazonS3Client.java:1337)
        at com.amazonaws.services.s3.AmazonS3Client.doesBucketExist(AmazonS3Client.java:1277)
        at org.apache.hadoop.fs.s3a.S3AFileSystem.lambda$verifyBucketExists$1(S3AFileSystem.java:373)
        at org.apache.hadoop.fs.s3a.Invoker.once(Invoker.java:109)
        ... 21 more
Caused by: com.amazonaws.SdkClientException: Unable to load credentials from service endpoint
        at com.amazonaws.auth.EC2CredentialsFetcher.handleError(EC2CredentialsFetcher.java:183)
        at com.amazonaws.auth.EC2CredentialsFetcher.fetchCredentials(EC2CredentialsFetcher.java:162)
        at com.amazonaws.auth.EC2CredentialsFetcher.getCredentials(EC2CredentialsFetcher.java:82)
        at com.amazonaws.auth.InstanceProfileCredentialsProvider.getCredentials(InstanceProfileCredentialsProvider.java:151)
        at org.apache.hadoop.fs.s3a.AWSCredentialProviderList.getCredentials(AWSCredentialProviderList.java:117)
        ... 35 more
Caused by: java.net.SocketTimeoutException: connect timed out
        at java.net.PlainSocketImpl.socketConnect(Native Method)
        at java.net.AbstractPlainSocketImpl.doConnect(AbstractPlainSocketImpl.java:350)
        at java.net.AbstractPlainSocketImpl.connectToAddress(AbstractPlainSocketImpl.java:206)
        at java.net.AbstractPlainSocketImpl.connect(AbstractPlainSocketImpl.java:188)
        at java.net.SocksSocketImpl.connect(SocksSocketImpl.java:392)
        at java.net.Socket.connect(Socket.java:589)
```

***

#### SOLUTION ####
Add below lines to all yarn nodemanager nodes, and restart yarn service.

After that, yarn will be able to pass the credential check.

``` bash
cat /etc/profile.d/hive.sh
export PATH=/hadoop/hive/bin:$PATH
export AWS_ACCESS_KEY_ID=${fs.s3a.access.key}
export AWS_SECRET_ACCESS_KEY=${fs.s3a.secret.key}

cat ~/.aws/credentials
[default]
aws_access_key_id = ${fs.s3a.access.key}
aws_secret_access_key = ${fs.s3a.secret.key}
```

Relative configuration:
Get ceph radosgw credential
```
radosgw-admin user info --uid s3a
{
    "user_id": "s3a",
    "display_name": "s3a",
    "email": "",
    "suspended": 0,
    "max_buckets": 100000,
    "auid": 0,
    "subusers": [
        {
            "id": "s3a:operator",
            "permissions": "full-control"
        }
    ],
    "keys": [
        {
            "user": "s3a",
            "access_key": ${fs.s3a.access.key},
            "secret_key": ${fs.s3a.secret.key}
        }
    ],
    "caps": [],
    "op_mask": "read, write, delete",
    "default_placement": "",
    "placement_tags": [],
    "bucket_quota": {
        "enabled": false,
        "check_on_raw": false,
        "max_size": -1,
        "max_size_kb": 0,
        "max_objects": -1
    },
    "user_quota": {
        "enabled": false,
        "check_on_raw": false,
        "max_size": -1,
        "max_size_kb": 0,
        "max_objects": -1
    },
    "temp_url_keys": [],
    "type": "rgw"
}

```

core-site.xml

``` xml
<property>
  <name>fs.defaultFS</name>
  <value>s3a://tpcds</value>
</property>
<property>
  <name>hadoop.tmp.dir</name>
  <value>/tmp/hadoop-${user.name}</value>
</property>
<property>
  <name>fs.s3a.access.key</name>
  <value>${fs.s3a.access.key}</value>
</property>
<property>
  <name>fs.s3a.secret.key</name>
  <value>${fs.s3a.secret.key}</value>
</property>
<property>
  <name>fs.s3a.endpoint</name>
  <value>rgw.intel.com:7481</value>
</property>

```

***

#### REASON ####

Exeption function in AWSCredentialProviderList.java

``` java
  /**
   * Iterate through the list of providers, to find one with credentials.
   * If {@link #reuseLastProvider} is true, then it is re-used.
   * @return a set of credentials (possibly anonymous), for authenticating.
   */
  @Override
  public AWSCredentials getCredentials() {
    checkNotEmpty();
    if (reuseLastProvider && lastProvider != null) {
      return lastProvider.getCredentials();
    }

    AmazonClientException lastException = null;
    for (AWSCredentialsProvider provider : providers) {
      try {
        AWSCredentials credentials = provider.getCredentials();
        if ((credentials.getAWSAccessKeyId() != null &&
            credentials.getAWSSecretKey() != null)
            || (credentials instanceof AnonymousAWSCredentials)) {
          lastProvider = provider;
          LOG.debug("Using credentials from {}", provider);
          return credentials;
        }
      } catch (AmazonClientException e) {
        lastException = e;
        LOG.debug("No credentials provided by {}: {}",
            provider, e.toString(), e);
      }
    }

    // no providers had any credentials. Rethrow the last exception
    // or create a new one.
    String message = "No AWS Credentials provided by "
        + listProviderNames();
    if (lastException != null) {
      message += ": " + lastException;
    }
    throw new AmazonClientException(message, lastException);

  }

```

This function will try to obtain credential iterately from three credential provider: BasicAWSCredentialsProvider EnvironmentVariableCredentialsProvider InstanceProfileCredentialsProvider

We are expecting it found credential by BasicAWSCredentialsProvider, while it failed.

Throught [Working with AWS Credentials reference](https://docs.aws.amazon.com/sdk-for-java/v1/developer-guide/credentials.html), I noticed add environment configuration works for EC2, so I also tried these in my node, since by checking with BasicAWSCredentialsProvider, hadoop called AmazonHttpClient codes.

And it worked.
