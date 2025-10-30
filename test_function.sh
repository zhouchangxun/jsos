# 说明：此脚本用于测试js实现的shell语言解释器sh.js支持的语言测试用例


echo "4. === 测试函数定义和调用==="
i=123
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
