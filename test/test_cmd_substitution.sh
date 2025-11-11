#!/bin/sh

# 测试直接的命令替换
echo "当前目录: $(pwd)"

# 测试变量替换后再命令替换
a="test"
echo "嵌套变量: $(ls $a)"

# 测试嵌套的命令替换
echo "嵌套命令: $(echo $(echo hello))"

# 测试在双引号中的多个命令替换
echo "多命令替换: $(echo 1) $(echo 2) $(echo 3)"