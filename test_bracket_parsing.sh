#!/bin/sh

echo "Testing bracket parsing fix..."

# 测试1：使用[ ]语法糖进行字符串比较
if [ "hello" == "hello" ]; then
  echo "String comparison with == succeeded"
fi

# 测试2：使用[ ]语法糖进行不等比较
if [ "hello" != "world" ]; then
  echo "String comparison with != succeeded"
fi

echo "Test completed"