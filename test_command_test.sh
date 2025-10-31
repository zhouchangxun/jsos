#!/bin/sh

echo "Testing if condition with commands..."

# 测试简单的命令条件
echo "\nTest 1: Command as condition"
if echo "this is a test"; then
    echo "Command succeeded"
else
    echo "Command failed"
fi

# 测试不存在的文件
echo "\nTest 2: test -f on non-existent file"
if test -f non_existent_file.txt; then
    echo "File exists"
else
    echo "File does not exist"
fi

# 测试字符串比较
echo "\nTest 3: String comparison with test"
if test "hello" = "hello"; then
    echo "Strings are equal"
else
    echo "Strings are not equal"
fi

# 测试空字符串检查
echo "\nTest 4: Empty string check"
if test -z ""; then
    echo "String is empty"
else
    echo "String is not empty"
fi

# 测试非空字符串检查
echo "\nTest 5: Non-empty string check"
if test -n "not empty"; then
    echo "String is not empty"
else
    echo "String is empty"
fi

# 测试复杂条件组合
echo "\nTest 6: Using semicolons in if condition"
if test -f non_existent_file.txt; then echo "File exists"; else echo "File does not exist"; fi

echo "\nAll tests completed."