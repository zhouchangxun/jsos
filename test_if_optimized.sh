#!/bin/sh
# 测试优化后的if条件语句
# 1. if只支持命令作为condition
# 2. 命令返回码为空表示true，非空表示false
# 3. 支持if [ ... ] 作为test命令的语法糖

echo "Testing user requirements..."

# 测试场景1：基本的test命令
if test -z ""; then
  echo "✅ test -z empty string works"
fi

# 测试场景2：[ ] 语法糖 - 字符串比较
if [ "hello" = "hello" ]; then
  echo "✅ [ ] syntax works for string comparison"
fi

# 测试场景3：[ ] 语法糖 - 文件检查（假设文件不存在）
if [ ! -f nonexistent_file.txt ]; then
  echo "✅ [ ! -f ] works for non-existent file"
fi

# 测试场景4：带分号的标准语法
if test -z ""; then echo "✅ Semicolon syntax works"; fi

# 测试场景5：带空格的分号
if test -z "" ; then echo "✅ Semicolon with space works"; fi


echo "Testing optimized if condition functionality..."

# 测试1：命令作为条件（echo命令返回空，应该为true）
echo "\nTest 1: Command as condition (echo)"
if echo "this is a test"; then
    echo "Command condition succeeded (correct)"
else
    echo "Command condition failed (incorrect)"
fi

# 测试2：[]语法糖支持
echo "\nTest 2: [] syntax support (string comparison)"
if [ "hello" = "hello" ]; then
    echo "[] condition succeeded when equal (correct)"
else
    echo "[] condition failed when equal (incorrect)"
fi

# 测试3：[]语法糖支持 - 不等比较
echo "\nTest 3: [] syntax support (string inequality)"
if [ "hello" != "world" ]; then
    echo "[] condition succeeded when not equal (correct)"
else
    echo "[] condition failed when not equal (incorrect)"
fi

# 测试4：空字符串检查
echo "\nTest 4: [] syntax - empty string check"
if [ -z "" ]; then
    echo "[] -z empty string check succeeded (correct)"
else
    echo "[] -z empty string check failed (incorrect)"
fi

# 测试5：非空字符串检查
echo "\nTest 5: [] syntax - non-empty string check"
if [ -n "not empty" ]; then
    echo "[] -n non-empty string check succeeded (correct)"
else
    echo "[] -n non-empty string check failed (incorrect)"
fi

# 测试6：test命令直接使用
echo "\nTest 6: Direct test command"
if test "hello" = "hello"; then
    echo "test command condition succeeded (correct)"
else
    echo "test command condition failed (incorrect)"
fi

echo "\nAll tests completed."