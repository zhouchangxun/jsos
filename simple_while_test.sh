#!/bin/sh

echo "Simple while loop test"

# 测试基本的while循环
i=0
while [ "$i" -lt 3 ]; do
  echo "Current value: $i"
  i=$((i + 1))
done

echo "Test completed"