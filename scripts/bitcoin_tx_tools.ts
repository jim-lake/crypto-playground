import * as bitcoin from 'bitcoinjs-lib';
import * as ecpair from 'ecpair';

export default {
  makeTx,
};

const MAX_LOOP = 10 * 1000;
export function makeTx(
  unspent_list,
  send_value,
  from,
  to,
  fee_per_byte,
  bitcoin_network,
  dust,
  input_type
) {
  unspent_list.sort(_sortHighest);
  let min_inputs = 0;
  let min_amount = 0;
  let min_fee;
  const all_opts = {
    send_value,
    from,
    to,
    fee_per_byte,
    bitcoin_network,
    dust,
    input_type,
  };
  unspent_list.every(({ value }) => {
    let ret = true;
    if (min_amount < send_value) {
      min_inputs++;
      min_amount += value;
    } else {
      min_fee = _calculateFee({
        ...all_opts,
        input_list: unspent_list.slice(0, min_inputs),
        include_change: false,
      });
      if (min_amount > send_value + min_fee) {
        ret = false;
      } else {
        min_inputs++;
        min_amount += value;
      }
    }
    return ret;
  });
  console.error({ min_inputs, min_amount, min_fee });
  let ret;
  if (min_amount > send_value + min_fee) {
    ret = _findPerfect({
      ...all_opts,
      unspent_list,
      input_count: min_inputs,
    });
    if (!ret) {
      ret = _makeChangeTx({
        ...all_opts,
        input_list: unspent_list.slice(0, min_inputs),
      });
    }
  }
  return ret;
}
function _findPerfect(params) {
  const { send_value, dust, unspent_list, input_count } = params;
  let ret;

  const perfect_fee = _calculateFee({
    ...params,
    input_list: unspent_list.slice(0, input_count),
    make_change: false,
  });
  const change_fee = _calculateFee({
    ...params,
    input_list: unspent_list.slice(0, input_count),
    make_change: true,
  });
  const min = send_value + Math.ceil(perfect_fee * 0.9);
  const max = send_value + Math.max(change_fee, dust);
  console.error({ min, max });
  const value_list = unspent_list.map((tx) => tx.value);

  const found_list = _findSumList(value_list, input_count, min, max);
  console.error(found_list);
  if (found_list) {
    const input_sum = _sum(found_list);
    const input_list = [];
    unspent_list.forEach((tx) => {
      const index = found_list.indexOf(tx.value);
      if (index !== -1) {
        found_list[index] = 0;
        input_list.push(tx);
      }
    });
    const unsigned_tx = _makeUnsigned({
      ...params,
      input_list,
      change: 0,
    });
    const fee = input_sum - send_value;
    ret = {
      unsigned_tx,
      fee,
    };
  }
  return ret;
}
function _makeChangeTx(params) {
  const { input_list, send_value, dust } = params;
  let ret;

  const fee = _calculateFee({
    ...params,
    make_change: true,
  });
  const input_sum = input_list.reduce((memo, { value }) => memo + value, 0);
  const change = input_sum - fee - send_value;
  if (change > dust) {
    const unsigned_tx = _makeUnsigned({
      ...params,
      change,
    });
    ret = {
      unsigned_tx,
      fee,
    };
  }
  return ret;
}
function _calculateFee(params): number {
  const { make_change, dust, fee_per_byte, bitcoin_network } = params;
  const signer = _getFakeSigner(bitcoin_network);
  const psbt = _makeUnsigned({
    ...params,
    send_value: dust,
    fake_inputs: true,
    change: make_change ? dust : 0,
  });
  psbt.signAllInputs(signer);
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction(true);
  const fee = Math.ceil(tx.virtualSize() * fee_per_byte);
  return fee;
}
function _makeUnsigned(params): bitcoin.Psbt {
  const {
    input_list,
    change,
    from,
    to,
    send_value,
    fake_inputs,
    input_type,
    bitcoin_network,
  } = params;
  const psbt = new bitcoin.Psbt({ network: bitcoin_network });

  input_list.forEach((input, i) => {
    let opts;
    if (input_type === 'p2pkh') {
      opts = fake_inputs
        ? _getFakeP2pkhInput(bitcoin_network, i)
        : {
            nonWitnessUtxo: input.raw,
            hash: input.hash,
            index: input.index,
          };
    } else {
      opts = {
        witnessUtxo: {
          script: fake_inputs
            ? _getFakeP2wpkhScript(bitcoin_network)
            : input.script,
          value: input.value,
        },
        hash: input.hash,
        index: input.index,
      };
    }
    psbt.addInput(opts);
  });
  psbt.addOutput({ address: to, value: send_value });
  if (change) {
    psbt.addOutput({ address: from, value: change });
  }
  return psbt;
}
function _sortHighest(a, b) {
  return b.value - a.value;
}
export function _findSumList(
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
function _sum(list: number[]): number {
  return list.reduce((memo, value) => memo + value, 0);
}

function _getFakeP2wpkhScript(bitcoin_network) {
  const addr = _getFakeP2wpkhAddress(bitcoin_network);
  return bitcoin.address.toOutputScript(addr, bitcoin_network);
}
function _getFakeP2pkhInput(bitcoin_network, index) {
  const fake = _getFakeForNetwork(bitcoin_network);
  const psbt = new bitcoin.Psbt({ network: bitcoin_network });
  psbt.addInput({
    hash: '0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098',
    index,
    witnessUtxo: {
      script: bitcoin.address.toOutputScript(fake.p2wpkh, bitcoin_network),
      value: 1e15,
    },
  });
  psbt.addOutput({
    address: fake.p2pkh,
    value: 1e15,
  });
  psbt.signAllInputs(fake.signer);
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction(true);
  return {
    hash: tx.getId(),
    index: 0,
    nonWitnessUtxo: tx.toBuffer(),
  };
}

const g_fakeToNetworkMap = new Map();
function _getFakeForNetwork(bitcoin_network) {
  let fake = g_fakeToNetworkMap.get(bitcoin_network);
  if (!fake) {
    const signer = ecpair.ECPair.makeRandom({ network: bitcoin_network });
    const payment_opts = {
      pubkey: signer.publicKey,
      network: bitcoin_network,
    };
    fake = {
      signer,
      p2wpkh: bitcoin.payments.p2wpkh(payment_opts).address,
      p2pkh: bitcoin.payments.p2pkh(payment_opts).address,
    };
    g_fakeToNetworkMap.set(bitcoin_network, fake);
  }
  return fake;
}
function _getFakeSigner(bitcoin_network) {
  return _getFakeForNetwork(bitcoin_network).signer;
}
function _getFakeP2wpkhAddress(bitcoin_network) {
  return _getFakeForNetwork(bitcoin_network).p2wpkh;
}
