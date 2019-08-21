---
layout: post
title: "Apache Arrow Gandiva on LLVM(Installation and evaluation)"
date: 2019-07-12
categories: [Spark, Arrow]
abstract: "Installation and evaluation of Apache Arrow and Gandiva."
abstract_img: ""
---

It took me some time to install gandiva, paste here for future reference.

llvm-7.0: 
Arrow Gandiva depends on LLVM, and I noticed current version strictly depends on llvm7.0 if you installed any other version rather than 7.0, it will fail.
``` bash
wget http://releases.llvm.org/7.0.1/llvm-7.0.1.src.tar.xz
tar xf llvm-7.0.1.src.tar.xz
cd llvm-7.0.1.src/
cd tools
wget http://releases.llvm.org/7.0.1/cfe-7.0.1.src.tar.xz
tar xf cfe-7.0.1.src.tar.xz
mv cfe-7.0.1.src clang
cd ..
mkdir build
cd build
cmake ..
cmake --build . -j
cmake --build . --target install
# check if clang has also been compiled, if no
cd tools/clang
mkdir build
cd build
cmake ..
make -j
make install
```

re2
``` bash
make
make test
make install
```

cmake: 
Arrow will download package during compiling, in order to support SSL in cmake, build cmake is optional.
``` bash
wget https://github.com/Kitware/CMake/releases/download/v3.15.0-rc4/cmake-3.15.0-rc4.tar.gz
tar xf cmake-3.15.0-rc4.tar.gz
cd cmake-3.15.0-rc4/
./bootstrap --system-curl --parallel=64 #parallel num depends on your server core number
make -j
make install
cmake --version
cmake version 3.15.0-rc4
```

Protobuf version should be above 2.6.0, I used 3.7.1 here, building from source

apache arrow and gandiva
``` bash
cd arrow/cpp/build
cmake -DARROW_GANDIVA_JAVA=ON -DARROW_GANDIVA=ON ..
make -j
make install

# build java
cd ../java
# change arrow.cpp.build.dir to the relative path of cpp build dir, 
# noted: since gandiva is subdir under java, so the relative path should add one more ../
mvn clean install -P arrow-jni -am -DskipTests -Darrow.cpp.build.dir=../../cpp/build/release
```

run test
``` bash
mvn test -pl gandiva -P arrow-jni
```

benchmark

Changed current gandiva MicroBenchmarkTest to a 10 fields * 200 Million records test
``` java
 @Test
  public void testAdd10() throws Exception {
    Field x = Field.nullable("x", int32);
    Field n2x = Field.nullable("n2x", int32);
    Field n3x = Field.nullable("n3x", int32);
    Field n4x = Field.nullable("n4x", int32);
    Field n5x = Field.nullable("n5x", int32);
    Field n6x = Field.nullable("n6x", int32);
    Field n7x = Field.nullable("n7x", int32);
    Field n8x = Field.nullable("n8x", int32);
    Field n9x = Field.nullable("n9x", int32);
    Field n10x = Field.nullable("n10x", int32);

    // x + n2x + n3x
    TreeNode add =
        TreeBuilder.makeFunction(
            "add", Lists.newArrayList(TreeBuilder.makeField(x), TreeBuilder.makeField(n2x)), int32);
    TreeNode add1 =
        TreeBuilder.makeFunction(
            "add", Lists.newArrayList(add, TreeBuilder.makeField(n3x)), int32);
    TreeNode add2 =
        TreeBuilder.makeFunction(
            "add", Lists.newArrayList(add1, TreeBuilder.makeField(n4x)), int32);
    TreeNode add3 =
        TreeBuilder.makeFunction(
            "add", Lists.newArrayList(add2, TreeBuilder.makeField(n5x)), int32);
    TreeNode add4 =
        TreeBuilder.makeFunction(
            "add", Lists.newArrayList(add3, TreeBuilder.makeField(n6x)), int32);
    TreeNode add5 =
        TreeBuilder.makeFunction(
            "add", Lists.newArrayList(add4, TreeBuilder.makeField(n7x)), int32);
    TreeNode add6 =
        TreeBuilder.makeFunction(
            "add", Lists.newArrayList(add5, TreeBuilder.makeField(n8x)), int32);
    TreeNode add7 =
        TreeBuilder.makeFunction(
            "add", Lists.newArrayList(add6, TreeBuilder.makeField(n9x)), int32);
    TreeNode add8 =
        TreeBuilder.makeFunction(
            "add", Lists.newArrayList(add7, TreeBuilder.makeField(n10x)), int32);
    ExpressionTree expr = TreeBuilder.makeExpression(add8, x);

    List<Field> cols = Lists.newArrayList(x, n2x, n3x, n4x, n5x, n6x, n7x, n8x, n9x, n10x);
    Schema schema = new Schema(cols);

    long timeTaken = timedProject(new Int32DataAndVectorGenerator(allocator),
        schema,
        Lists.newArrayList(expr),
        200 * MILLION, 16 * THOUSAND,
        4);
    System.out.println("Time taken for projecting 200m records of add10 is " + timeTaken + "ms");
  }

```

``` bash
mvn test -pl gandiva -P arrow-jni -Dtest=MicroBenchmarkTest
```
![Benchmark result](/static/img/2019-07-12-Apache-Arrow-Gandiva-on-LLVM/benchmark.png)
---





