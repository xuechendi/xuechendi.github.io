---
layout: post
title: "Prepare TPCDS data for spark"
date: 2019-07-12
categories: [Spark]
abstract: "Step by steps to install a tpcds kit and then prepare tpcds data."
abstract_img: ""
---

I am currently working on spark sql vectorization implementation, and I felt there are so many options for preparing TPCDS data on hdfs, and I chose below method becaused the simplicity and hackability.

### Install DataBricks SparkSqlPerf kit

```bash
git clone https://github.com/databricks/spark-sql-perf
cd spark-sql-perf
sbt +package
```

### Install TPCDS kit

```bash
sudo yum install gcc make flex bison byacc git
git clone https://github.com/databricks/tpcds-kit.git
cd tpcds-kit/tools
make OS=LINUX
cd ..
```

### TPCDS Preparation script and submit

```bash
vim TPCDSPreparation.scala
```

```scala
import com.databricks.spark.sql.perf.tpcds.TPCDSTables
import org.apache.spark.sql._

// Set:
val rootDir: String = "hdfs://sr602:9000/tpcds_1T" // root directory of location to create data in.
val databaseName: String = "tpcds_1T" // name of database to create.
val scaleFactor: String = "1000" // scaleFactor defines the size of the dataset to generate (in GB).
val format: String = "parquet" // valid spark format like parquet "parquet".
val sqlContext = new SQLContext(sc)
// Run:
val tables = new TPCDSTables(sqlContext,
    dsdgenDir = "/mnt/nvme2/chendi/spark-sql-perf/tpcds-kit/tools", // location of dsdgen
    scaleFactor = scaleFactor,
    useDoubleForDecimal = false, // true to replace DecimalType with DoubleType
    useStringForDate = false) // true to replace DateType with StringType

tables.genData(
    location = rootDir,
    format = format,
    overwrite = true, // overwrite the data that is already there
    partitionTables = true, // create the partitioned fact tables
    clusterByPartitionColumns = true, // shuffle to get partitions coalesced into single files.
    filterOutNullPartitionValues = false, // true to filter out the partition with NULL key value
    tableFilter = "", // "" means generate all tables
    numPartitions = 400) // how many dsdgen partitions to run - number of input tasks.

// Create the specified database
sql(s"create database $databaseName")
// Create metastore tables in a specified database for your data.
// Once tables are created, the current database will be switched to the specified database.
tables.createExternalTables(rootDir, "parquet", databaseName, overwrite = true, discoverPartitions = true)
```

```bash
# configure spark-defaults.conf
spark.driver.extraClassPath /mnt/nvme2/chendi/spark-sql-perf/target/scala-2.11/spark-sql-perf_2.11-0.5.1-SNAPSHOT.jar
spark.executor.extraClassPath /mnt/nvme2/chendi/spark-sql-perf/target/scala-2.11/spark-sql-perf_2.11-0.5.1-SNAPSHOT.jar

# using spark-shell to run TPCDS preparation scala
# that is one in above scala, we can assume sc(sparkcontext) exists.
spark-shell --master yarn --deploy-mode client -i TPCDSPreparation.scala

# expects output as below
[root@sr602 spark-gpu]# spark-shell --master yarn --deploy-mode client -i TPCDSPreparation.scala
19/08/12 10:35:00 WARN NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
Setting default log level to "WARN".
To adjust logging level use sc.setLogLevel(newLevel). For SparkR, use setLogLevel(newLevel).
19/08/12 10:35:06 WARN Client: Neither spark.yarn.jars nor spark.yarn.archive is set, falling back to uploading libraries under SPARK_HOME.
Spark context Web UI available at http://vsr602:4040
Spark context available as 'sc' (master = yarn, app id = application_1565311463008_0088).
Spark session available as 'spark'.
Loading TPCDSPreparation.scala...
import com.databricks.spark.sql.perf.tpcds.TPCDSTables
import org.apache.spark.sql._
rootDir: String = hdfs://sr602:9000/tpcds_1T
databaseName: String = tpcds_1T
scaleFactor: String = 1000
format: String = parquet
warning: there was one deprecation warning; re-run with -deprecation for details
sqlContext: org.apache.spark.sql.SQLContext = org.apache.spark.sql.SQLContext@541897c6
tables: com.databricks.spark.sql.perf.tpcds.TPCDSTables = com.databricks.spark.sql.perf.tpcds.TPCDSTables@1d1fd2aa
19/08/12 10:35:35 WARN Utils: Truncated the string representation of a plan since it was too large. This behavior can be adjusted by setting 'spark.debug.maxToStringFields' in SparkEnv.conf.
Pre-clustering with partitioning columns with query
SELECT
  cs_sold_date_sk,cs_sold_time_sk,cs_ship_date_sk,cs_bill_customer_sk,cs_bill_cdemo_sk,cs_bill_hdemo_sk,cs_bill_addr_sk,cs_ship_customer_sk,cs_ship_cdemo_sk,cs_ship_hdemo_sk,cs_ship_addr_sk,cs_call_center_sk,cs_catal
og_page_sk,cs_ship_mode_sk,cs_warehouse_sk,cs_item_sk,cs_promo_sk,cs_order_number,cs_quantity,cs_wholesale_cost,cs_list_price,cs_sales_price,cs_ext_discount_amt,cs_ext_sales_price,cs_ext_wholesale_cost,cs_ext_list_pr
ice,cs_ext_tax,cs_coupon_amt,cs_ext_ship_cost,cs_net_paid,cs_net_paid_inc_tax,cs_net_paid_inc_ship,cs_net_paid_inc_ship_tax,cs_net_profit
FROM
  catalog_sales_text

DISTRIBUTE BY
  cs_sold_date_sk
            .
Generating table catalog_sales in database to hdfs://sr602:9000/tpcds_1T/catalog_sales with save mode Overwrite.
[Stage 0:========>                                              (62 + 80) / 400]

```






