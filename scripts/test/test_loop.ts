export {};

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

function _findSumList(
  list: number[],
  out_len: number,
  min: number,
  max: number
): number[] | null {
  let test_list: number[] | null = list.slice(0, out_len - 1);
  let result_list = null;
  let loop_count = 0;
  while (test_list && loop_count < MAX_LOOP) {
    const test_sum = _sum(test_list);
    if (test_sum < max) {
      const end_test = test_list[test_list.length - 1];
      let i = out_len > 1 ? list.findIndex((v) => v < end_test) : 0;
      for (; i < list.length; i++) {
        const new_sum = test_sum + list[i];
        if (new_sum < min) {
          break;
        } else if (new_sum >= min && new_sum <= max) {
          result_list = [...test_list, list[i]];
          break;
        }
      }
      loop_count += list.length;
    }
    if (result_list) {
      break;
    } else {
      const old_list: number[] = test_list;
      test_list = null;
      for (let i = old_list.length - 1; i > 0; i--) {
        const val = old_list[i];
        const found_index = list.findIndex((v) => v < val);
        if (found_index !== -1) {
          test_list = [
            ...old_list.slice(0, i),
            ...list.slice(found_index, found_index + out_len - i - 1),
          ];
          break;
        }
      }
    }
  }
  return result_list;
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
