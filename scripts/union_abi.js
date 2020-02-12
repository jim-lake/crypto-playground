
const fs = require('fs');
const argv = process.argv.slice(2);

if (argv.length < 1) {
  console.log(`Usage: ${process.argv[1]} <abi1> <abi2>`);
  process.exit(-1);
}

const abi1 = JSON.parse(fs.readFileSync(argv[0]));
const abi2 = JSON.parse(fs.readFileSync(argv[1]));


abi2.forEach(method => {
  if (!_hasFunction(abi1,method)) {
    console.error("+",method.name);
    abi1.push(method);
  } else {
    console.error("=",method.name);
  }
});

console.log(JSON.stringify(abi1,null," "));


function _hasFunction(abi,method2) {
  return abi.some(method1 => {
    let ret = false;
    if (method1.name === method2.name) {
      if (!method1.inputs && !method2.inputs) {
        ret = true;
      } else if (method1.inputs && method2.inputs && method1.inputs.length === method2.inputs.length) {
        ret = true;
      }
    }
    return ret;
  });
}
