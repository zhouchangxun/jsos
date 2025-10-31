#!/bin/sh

echo "Testing while with true command"

# 使用true命令作为条件，并使用break控制循环次数
count=0
while true; do
  echo "Loop iteration $count"
  count=0 # 由于$((可能有问题，我们简单测试一次就退出)
  break
done

echo "Test completed"