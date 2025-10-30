# 说明：此脚本用于测试js实现的shell语言解释器sh.js支持的语言测试用例

echo "1. === 测试变量定义和引用==="
# 测试变量定义和使用
NAME="OS.js"
VERSION="1.0"
echo "系统名称: $NAME"
echo "系统版本: $VERSION"

echo "2. === 测试条件判断==="
if  $VERSION == "1.0" ; then
    echo "版本是1.0"
else
    echo "版本不是1.0"
fi

echo "3. === 测试循环==="
for i in 1 2 3; do
    echo "循环计数: $i"
done

echo "4. === 测试函数定义和调用==="
function hi() {
  echo "hello, $1";
  if $1 == 'bob';then
    echo "i like bob";
  else
    echo "i hate $1";
  fi
}
# 测试函数调用
hi bob;

echo "5. === 测试循环嵌套==="
for i in 1 2 3; do
    echo "外部循环计数: $i"
    for j in 1 2 3; do
        echo "  内部循环计数: $j"
    done
done

echo "6. === 测试循环嵌套和条件判断==="
for i in 1 2 3; do
    echo "外部循环计数: $i"
    for j in 1 2 3; do
        echo "  内部循环计数: $j"
        if  "$i" == "$j" ; then
            echo "    相等"
        else
            echo "    不相等"
        fi
    done
done

echo "7. === 测试函数嵌套调用==="
function outer() {
    echo "outer function"
    inner
}

function inner() {
    echo "inner function"
}

outer