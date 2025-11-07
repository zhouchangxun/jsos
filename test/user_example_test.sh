#!/bin/sh

echo "Testing user's specific example..."

# 完全按照用户提供的示例执行
a=10; if [ $a -eq 10 ]; then echo "a is 10"; else echo "no"; fi;for i in 1 2 3; do echo $i; done;i=0;while [ $i -lt 3 ];do echo $i;i=$((i+1));done;