#!/bin/sh

echo "Testing while with break"

# 使用简单的echo命令作为条件
while echo "Condition true"; do
  echo "Inside loop"
  break # 应该只执行一次循环体
done

echo "Test completed"