export {};

import { _findSumList } from '../bitcoin_tx_tools';

const MAX_LOOP = 100 * 1000;

_test(10, 1 * 1000, 100 * 1000, 100 * 1000, 110 * 1000);
_test(100, 1 * 1000, 10 * 1000, 100 * 1000, 110 * 1000);
_test(100, 10 * 1000, 20 * 1000, 100 * 1000, 120 * 1000);
_test(1000, 1 * 1000, 10 * 1000, 1000 * 1000, 1000.01 * 1000);

function _test(list_len, rand_min, rand_max, min, max) {
  const list = [];
  for (let i = 0; i < list_len; i++) {
    list.push(randomRangeInt(rand_min, rand_max));
  }
  list.sort(_sortVal);

  let input_count = 1;
  let input_sum = 0;
  for (; input_count <= list_len; input_count++) {
    input_sum += list[input_count - 1];
    if (input_sum > min) {
      break;
    }
  }

  const result = _findSumList(list, input_count, min, max);
  if (result) {
    const sum = _sum(result);
    console.log(
      '_test:',
      list_len,
      input_count,
      '=>',
      ...result,
      'value: ' + max,
      '>',
      sum,
      '> ' + min
    );
  } else {
    console.log('_test:', list_len, input_count, '=> not found');
  }
}
function _sum(list) {
  return list.reduce((memo, value) => memo + value, 0);
}
function _sortVal(a, b) {
  return b - a;
}
function randomRangeInt(min, max) {
  let ret;
  if (min === max) {
    // common code path that always rolls, even when its deterministic
    ret = min;
  } else {
    ret = Math.floor(Math.random() * (max - min + 1)) + min;
  }
  return ret;
}
