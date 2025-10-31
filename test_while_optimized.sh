#!/bin/sh

echo "Testing while loop optimization..."

# 测试1：使用true命令作为条件的while循环（运行3次后退出）
count=0
echo "\nTest 1: while with true command (should run 3 times)"
while true; do
  echo "Loop iteration $count"
  count=$((count + 1))
  if [ "$count" -eq 3 ]; then
    break
  fi
done

# 测试2：使用[ ]语法糖进行字符串比较的while循环
test_str="hello"
echo "\nTest 2: while with [] syntax for string comparison"
while [ "$test_str" = "hello" ]; do
  echo "String comparison succeeded"
  test_str="world" # 修改后下次循环将退出
done

echo "\nTest 3: while with [] syntax for file check (non-existent file)"
while [ ! -f nonexistent_file.txt ]; do
  echo "Non-existent file check succeeded"
  break # 只运行一次
done

# 测试4：使用test命令的while循环
echo "\nTest 4: while with explicit test command"
while test -z ""; do
  echo "Empty string test succeeded"
  break # 只运行一次
done

echo "\nAll while loop tests completed."