#!/bin/sh

# 示例shell脚本，展示sh.js支持的各种语言特性
# 展示了sh.js支持的各种语言特性：
# 1. 变量定义与使用 - 演示了变量赋值和通过$符号引用变量
# 2. 函数定义与调用 - 实现了welcome_message函数，展示了参数传递和$#参数数量获取
# 3. 条件语句 - 使用if-else-if结构进行数值比较判断
# 4. 循环结构 - 实现了基于条件的while循环
# 5. 嵌套函数与循环 - 创建了print_table函数，展示了嵌套while循环和局部变量使用
# 6. 条件与函数结合 - 实现check_range函数，演示了返回值和条件判断的结合
# 7. 多行语句块 - 展示了嵌套的if语句块，支持多行代码结构
# 这个脚本可以作为sh.js shell语言功能的完整示例，用户可以通过执行 
# sh example_shell_script.sh 来测试和查看各种语言特性的运行效果。
# 脚本包含了详细的注释，清晰地说明了每个部分的功能，便于理解和学习。

echo "=== Shell脚本功能演示 ==="

# 1. 变量定义和使用
NAME="OS.js"
VERSION="1.0"
echo "系统名称: $NAME"
echo "系统版本: $VERSION"

# 2. 函数定义示例
welcome_message() {
    echo "欢迎使用$1 $2!"
    echo "参数数量: $#"
    echo "当前目录: $(pwd)"
}

# 函数调用
welcome_message $NAME $VERSION

# 3. if-else条件语句演示
COUNT=5
echo "\n=== 条件判断演示 ==="
if [ "$COUNT" -gt 10 ]; then
    echo "计数大于10"
elif [ "$COUNT" -eq 5 ]; then
    echo "计数等于5"
else
    echo "计数小于10且不等于5"
fi

# 4. while循环演示
echo "\n=== 循环演示 ==="
INDEX=1
while [ "$INDEX" -le 5 ]; do
    echo "循环计数: $INDEX"
    INDEX=$((INDEX + 1))
done

# 5. 嵌套函数和循环
echo "\n=== 嵌套函数演示 ==="
print_table() {
    local rows=$1
    local cols=$2
    
    local i=1
    while [ "$i" -le "$rows" ]; do
        local j=1
        local line=""
        
        while [ "$j" -le "$cols" ]; do
            line="$line [$i,$j]"
            j=$((j + 1))
        done
        
        echo "$line"
        i=$((i + 1))
    done
}

# 调用嵌套函数
print_table 3 4

# 6. 使用if-else与函数结合
echo "\n=== 函数与条件结合 ==="
check_range() {
    local num=$1
    local min=$2
    local max=$3
    
    if [ "$num" -lt "$min" ]; then
        echo "$num 小于最小值 $min"
        return 1
    elif [ "$num" -gt "$max" ]; then
        echo "$num 大于最大值 $max"
        return 1
    else
        echo "$num 在范围内 [$min, $max]"
        return 0
    fi
}

# 测试函数
check_range 15 10 20
check_range 5 10 20

# 7. 多行语句块示例
echo "\n=== 多行语句块 ==="
if [ "$NAME" = "OS.js" ]; then 
  echo "检测到OS.js系统"
  if [ "$VERSION" = "1.0" ]; then
    echo "这是版本1.0"
  fi
fi

echo "\n=== 脚本执行完成 ==="