contract Contract {
    function main() {
        memory[0x40:0x60] = 0x80;

        if (msg.data.length < 0x04) { stop(); }

        var var0 = msg.data[0x00:0x20] >> 0xe0;

        if (0x715018a6 > var0) {
            if (var0 == 0x104e20b8) {
                // Dispatch table entry for 0x104e20b8 (unknown)
                var var1 = msg.value;

                if (var1) { revert(memory[0x00:0x00]); }

                var1 = 0x00d9;
                var1 = func_03A1();
                var temp0 = memory[0x40:0x60];
                memory[temp0:temp0 + 0x20] = var1;
                var temp1 = memory[0x40:0x60];
                return memory[temp1:temp1 + (temp0 + 0x20) - temp1];
            } else if (var0 == 0x2e1a7d4d) {
                // Dispatch table entry for withdraw(uint256)
                var1 = msg.value;

                if (var1) { revert(memory[0x00:0x00]); }

                var1 = 0x0128;
                var var2 = 0x04;
                var var3 = msg.data.length - var2;

                if (var3 < 0x20) { revert(memory[0x00:0x00]); }

                withdraw(var2, var3);
                stop();
            } else if (var0 == 0x30a36bed) {
                // Dispatch table entry for 0x30a36bed (unknown)
                var1 = msg.value;

                if (var1) { revert(memory[0x00:0x00]); }

                var1 = 0x013f;
                var1 = func_0502();
                var temp2 = memory[0x40:0x60];
                memory[temp2:temp2 + 0x20] = !!var1;
                var temp3 = memory[0x40:0x60];
                return memory[temp3:temp3 + (temp2 + 0x20) - temp3];
            } else if (var0 == 0x34dc9b9a) {
                // Dispatch table entry for 0x34dc9b9a (unknown)
                var1 = msg.value;

                if (var1) { revert(memory[0x00:0x00]); }

                var1 = 0x01a8;
                var2 = 0x04;
                var3 = msg.data.length - var2;

                if (var3 < 0x20) { revert(memory[0x00:0x00]); }

                var1 = func_017C(var2, var3);
                var temp4 = memory[0x40:0x60];
                memory[temp4:temp4 + 0x20] = var1;
                var temp5 = memory[0x40:0x60];
                return memory[temp5:temp5 + (temp4 + 0x20) - temp5];
            } else if (var0 == 0x612f2f37) {
                // Dispatch table entry for setMaintenance(bool)
                var1 = msg.value;

                if (var1) { revert(memory[0x00:0x00]); }

                var1 = 0x01f9;
                var2 = 0x04;
                var3 = msg.data.length - var2;

                if (var3 < 0x20) { revert(memory[0x00:0x00]); }

                setMaintenance(var2, var3);
                stop();
            } else if (var0 == 0x63d83eeb) {
                // Dispatch table entry for 0x63d83eeb (unknown)
                var1 = msg.value;

                if (var1) { revert(memory[0x00:0x00]); }

                var1 = 0x0234;
                var2 = 0x04;
                var3 = msg.data.length - var2;

                if (var3 < 0x20) { revert(memory[0x00:0x00]); }

                func_021E(var2, var3);
                stop();
            } else { stop(); }
        } else if (0x95c9eb9b > var0) {
            if (var0 == 0x715018a6) {
                // Dispatch table entry for renounceOwnership()
                var1 = msg.value;

                if (var1) { revert(memory[0x00:0x00]); }

                var1 = 0x024b;
                renounceOwnership();
                stop();
            } else if (var0 == 0x8da5cb5b) {
                // Dispatch table entry for owner()
                var1 = msg.value;

                if (var1) { revert(memory[0x00:0x00]); }

                var1 = 0x0262;
                var1 = owner();
                var temp6 = memory[0x40:0x60];
                memory[temp6:temp6 + 0x20] = var1 & 0xffffffffffffffffffffffffffffffffffffffff;
                var temp7 = memory[0x40:0x60];
                return memory[temp7:temp7 + (temp6 + 0x20) - temp7];
            } else if (var0 == 0x8f32d59b) {
                // Dispatch table entry for isOwner()
                var1 = msg.value;

                if (var1) { revert(memory[0x00:0x00]); }

                var1 = 0x02b9;
                var1 = isOwner();
                var temp8 = memory[0x40:0x60];
                memory[temp8:temp8 + 0x20] = !!var1;
                var temp9 = memory[0x40:0x60];
                return memory[temp9:temp9 + (temp8 + 0x20) - temp9];
            } else { stop(); }
        } else if (var0 == 0x95c9eb9b) {
            // Dispatch table entry for 0x95c9eb9b (unknown)
            var1 = msg.value;

            if (var1) { revert(memory[0x00:0x00]); }

            var1 = 0x02e8;
            var1 = func_0836();
            var temp10 = memory[0x40:0x60];
            memory[temp10:temp10 + 0x20] = var1;
            var temp11 = memory[0x40:0x60];
            return memory[temp11:temp11 + (temp10 + 0x20) - temp11];
        } else if (var0 == 0xc8beb577) {
            // Dispatch table entry for 0xc8beb577 (unknown)
            var1 = msg.value;

            if (var1) { revert(memory[0x00:0x00]); }

            var1 = 0x0337;
            var2 = 0x04;
            var3 = msg.data.length - var2;

            if (var3 < 0x20) { revert(memory[0x00:0x00]); }

            func_0321(var2, var3);
            stop();
        } else if (var0 == 0xcd3c8781) {
            // Dispatch table entry for 0xcd3c8781 (unknown)
            var1 = msg.value;

            if (var1) { revert(memory[0x00:0x00]); }

            var1 = 0x034e;
            func_08C4();
            stop();
        } else if (var0 == 0xf2fde38b) {
            // Dispatch table entry for transferOwnership(address)
            var1 = msg.value;

            if (var1) { revert(memory[0x00:0x00]); }

            var1 = 0x039f;
            var2 = 0x04;
            var3 = msg.data.length - var2;

            if (var3 < 0x20) { revert(memory[0x00:0x00]); }

            transferOwnership(var2, var3);
            stop();
        } else { stop(); }
    }

    function withdraw(var arg0, var arg1) {
        arg0 = msg.data[arg0:arg0 + 0x20];
        arg1 = 0x03b3;
        arg1 = isOwner();

        if (arg1) {
            arg1 = address(this);

            if (address(arg1 & 0xffffffffffffffffffffffffffffffffffffffff).balance >= arg0) {
                var temp0 = arg0;
                var temp1 = memory[0x40:0x60];
                var temp2;
                temp2, memory[temp1:temp1 + 0x00] = address(msg.sender).call.gas(!temp0 * 0x08fc).value(temp0)(memory[temp1:temp1 + memory[0x40:0x60] - temp1]);
                var var0 = !temp2;

                if (!var0) { return; }

                var temp3 = returndata.length;
                memory[0x00:0x00 + temp3] = returndata[0x00:0x00 + temp3];
                revert(memory[0x00:0x00 + returndata.length]);
            } else {
                var temp4 = memory[0x40:0x60];
                memory[temp4:temp4 + 0x20] = 0x08c379a000000000000000000000000000000000000000000000000000000000;
                var temp5 = temp4 + 0x04;
                var temp6 = temp5 + 0x20;
                memory[temp5:temp5 + 0x20] = temp6 - temp5;
                memory[temp6:temp6 + 0x20] = 0x1d;
                var temp7 = temp6 + 0x20;
                memory[temp7:temp7 + 0x20] = 0x696e73756666696369656e7420636f6e74726163742062616c616e6365000000;
                var temp8 = memory[0x40:0x60];
                revert(memory[temp8:temp8 + (temp7 + 0x20) - temp8]);
            }
        } else {
            var temp9 = memory[0x40:0x60];
            memory[temp9:temp9 + 0x20] = 0x08c379a000000000000000000000000000000000000000000000000000000000;
            var temp10 = temp9 + 0x04;
            var temp11 = temp10 + 0x20;
            memory[temp10:temp10 + 0x20] = temp11 - temp10;
            memory[temp11:temp11 + 0x20] = 0x20;
            var temp12 = temp11 + 0x20;
            memory[temp12:temp12 + 0x20] = 0x4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e6572;
            var temp13 = memory[0x40:0x60];
            revert(memory[temp13:temp13 + (temp12 + 0x20) - temp13]);
        }
    }

    function func_017C(var arg0, var arg1) returns (var r0) {
        arg0 = msg.data[arg0:arg0 + 0x20] & 0xffffffffffffffffffffffffffffffffffffffff;
        memory[0x00:0x20] = arg0 & 0xffffffffffffffffffffffffffffffffffffffff;
        memory[0x20:0x40] = 0x01;
        return storage[keccak256(memory[0x00:0x40])];
    }

    function setMaintenance(var arg0, var arg1) {
        arg0 = !!msg.data[arg0:arg0 + 0x20];
        arg1 = 0x056a;
        arg1 = isOwner();

        if (arg1) {
            storage[0x02] = !!arg0 | (storage[0x02] & ~0xff);
            return;
        } else {
            var temp0 = memory[0x40:0x60];
            memory[temp0:temp0 + 0x20] = 0x08c379a000000000000000000000000000000000000000000000000000000000;
            var temp1 = temp0 + 0x04;
            var temp2 = temp1 + 0x20;
            memory[temp1:temp1 + 0x20] = temp2 - temp1;
            memory[temp2:temp2 + 0x20] = 0x20;
            var temp3 = temp2 + 0x20;
            memory[temp3:temp3 + 0x20] = 0x4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e6572;
            var temp4 = memory[0x40:0x60];
            revert(memory[temp4:temp4 + (temp3 + 0x20) - temp4]);
        }
    }

    function func_021E(var arg0, var arg1) {
        arg0 = msg.data[arg0:arg0 + 0x20];
        arg1 = 0x0601;
        arg1 = isOwner();

        if (arg1) {
            storage[0x03] = arg0;
            return;
        } else {
            var temp0 = memory[0x40:0x60];
            memory[temp0:temp0 + 0x20] = 0x08c379a000000000000000000000000000000000000000000000000000000000;
            var temp1 = temp0 + 0x04;
            var temp2 = temp1 + 0x20;
            memory[temp1:temp1 + 0x20] = temp2 - temp1;
            memory[temp2:temp2 + 0x20] = 0x20;
            var temp3 = temp2 + 0x20;
            memory[temp3:temp3 + 0x20] = 0x4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e6572;
            var temp4 = memory[0x40:0x60];
            revert(memory[temp4:temp4 + (temp3 + 0x20) - temp4]);
        }
    }

    function func_0321(var arg0, var arg1) {
        arg0 = msg.data[arg0:arg0 + 0x20];
        arg1 = 0x0848;
        arg1 = isOwner();

        if (arg1) {
            storage[0x04] = arg0;
            return;
        } else {
            var temp0 = memory[0x40:0x60];
            memory[temp0:temp0 + 0x20] = 0x08c379a000000000000000000000000000000000000000000000000000000000;
            var temp1 = temp0 + 0x04;
            var temp2 = temp1 + 0x20;
            memory[temp1:temp1 + 0x20] = temp2 - temp1;
            memory[temp2:temp2 + 0x20] = 0x20;
            var temp3 = temp2 + 0x20;
            memory[temp3:temp3 + 0x20] = 0x4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e6572;
            var temp4 = memory[0x40:0x60];
            revert(memory[temp4:temp4 + (temp3 + 0x20) - temp4]);
        }
    }

    function transferOwnership(var arg0, var arg1) {
        arg0 = msg.data[arg0:arg0 + 0x20] & 0xffffffffffffffffffffffffffffffffffffffff;
        arg1 = 0x0bdf;
        arg1 = isOwner();

        if (arg1) {
            arg1 = 0x0c5a;
            var var0 = arg0;
            func_0C5D(var0);
            return;
        } else {
            var temp0 = memory[0x40:0x60];
            memory[temp0:temp0 + 0x20] = 0x08c379a000000000000000000000000000000000000000000000000000000000;
            var temp1 = temp0 + 0x04;
            var temp2 = temp1 + 0x20;
            memory[temp1:temp1 + 0x20] = temp2 - temp1;
            memory[temp2:temp2 + 0x20] = 0x20;
            var temp3 = temp2 + 0x20;
            memory[temp3:temp3 + 0x20] = 0x4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e6572;
            var temp4 = memory[0x40:0x60];
            revert(memory[temp4:temp4 + (temp3 + 0x20) - temp4]);
        }
    }

    function func_03A1() returns (var r0) { return storage[0x04]; }

    function func_0502() returns (var r0) { return storage[0x02] & 0xff; }

    function renounceOwnership() {
        var var0 = 0x0685;
        var0 = isOwner();

        if (var0) {
            var temp0 = memory[0x40:0x60];
            log(memory[temp0:temp0 + memory[0x40:0x60] - temp0], [0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0, storage[0x00] & 0xffffffffffffffffffffffffffffffffffffffff, 0xffffffffffffffffffffffffffffffffffffffff & 0x00]);
            storage[0x00] = (storage[0x00] & ~0xffffffffffffffffffffffffffffffffffffffff) | 0x00;
            return;
        } else {
            var temp1 = memory[0x40:0x60];
            memory[temp1:temp1 + 0x20] = 0x08c379a000000000000000000000000000000000000000000000000000000000;
            var temp2 = temp1 + 0x04;
            var temp3 = temp2 + 0x20;
            memory[temp2:temp2 + 0x20] = temp3 - temp2;
            memory[temp3:temp3 + 0x20] = 0x20;
            var temp4 = temp3 + 0x20;
            memory[temp4:temp4 + 0x20] = 0x4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e6572;
            var temp5 = memory[0x40:0x60];
            revert(memory[temp5:temp5 + (temp4 + 0x20) - temp5]);
        }
    }

    function owner() returns (var r0) { return storage[0x00] & 0xffffffffffffffffffffffffffffffffffffffff; }

    function isOwner() returns (var r0) { return msg.sender == storage[0x00] & 0xffffffffffffffffffffffffffffffffffffffff; }

    function func_0836() returns (var r0) { return storage[0x03]; }

    function func_08C4() {
        if (!!(storage[0x02] & 0xff) != !!0x00) {
            var temp22 = memory[0x40:0x60];
            memory[temp22:temp22 + 0x20] = 0x08c379a000000000000000000000000000000000000000000000000000000000;
            var temp23 = temp22 + 0x04;
            var temp24 = temp23 + 0x20;
            memory[temp23:temp23 + 0x20] = temp24 - temp23;
            memory[temp24:temp24 + 0x20] = 0x11;
            var temp25 = temp24 + 0x20;
            memory[temp25:temp25 + 0x20] = 0x6d61696e74656e616e63652074696d652e000000000000000000000000000000;
            var temp26 = memory[0x40:0x60];
            revert(memory[temp26:temp26 + (temp25 + 0x20) - temp26]);
        } else if (storage[0x03] > 0x00) {
            memory[0x00:0x20] = msg.sender;
            memory[0x20:0x40] = 0x01;

            if (block.timestamp > storage[keccak256(memory[0x00:0x40])] + storage[0x03]) {
                memory[0x00:0x20] = msg.sender;
                memory[0x20:0x40] = 0x01;
                storage[keccak256(memory[0x00:0x40])] = block.timestamp;

                if (tx.gasprice <= 0x02540be400) {
                    var temp0 = tx.gasprice * storage[0x04];
                    var temp1 = memory[0x40:0x60];
                    var temp2;
                    temp2, memory[temp1:temp1 + 0x00] = address(msg.sender).call.gas(!temp0 * 0x08fc).value(temp0)(memory[temp1:temp1 + memory[0x40:0x60] - temp1]);
                    var var0 = !temp2;

                    if (!var0) {
                        var temp3 = memory[0x40:0x60];
                        memory[temp3:temp3 + 0x20] = msg.sender;
                        var temp4 = memory[0x40:0x60];
                        log(memory[temp4:temp4 + (temp3 + 0x20) - temp4], [0x5a65b0439d26cb9dd22c91162746d3259083693f7ef8a51e97e212db243de813]);
                        return;
                    } else {
                        var temp5 = returndata.length;
                        memory[0x00:0x00 + temp5] = returndata[0x00:0x00 + temp5];
                        revert(memory[0x00:0x00 + returndata.length]);
                    }
                } else {
                    var temp6 = storage[0x04] * 0x02540be400;
                    var temp7 = memory[0x40:0x60];
                    var temp8;
                    temp8, memory[temp7:temp7 + 0x00] = address(msg.sender).call.gas(!temp6 * 0x08fc).value(temp6)(memory[temp7:temp7 + memory[0x40:0x60] - temp7]);
                    var0 = !temp8;

                    if (!var0) {
                        var temp9 = memory[0x40:0x60];
                        memory[temp9:temp9 + 0x20] = msg.sender;
                        var temp10 = memory[0x40:0x60];
                        log(memory[temp10:temp10 + (temp9 + 0x20) - temp10], [0x5a65b0439d26cb9dd22c91162746d3259083693f7ef8a51e97e212db243de813]);
                        return;
                    } else {
                        var temp11 = returndata.length;
                        memory[0x00:0x00 + temp11] = returndata[0x00:0x00 + temp11];
                        revert(memory[0x00:0x00 + returndata.length]);
                    }
                }
            } else {
                var temp12 = memory[0x40:0x60];
                memory[temp12:temp12 + 0x20] = 0x08c379a000000000000000000000000000000000000000000000000000000000;
                var temp13 = temp12 + 0x04;
                var temp14 = temp13 + 0x20;
                memory[temp13:temp13 + 0x20] = temp14 - temp13;
                memory[temp14:temp14 + 0x20] = 0x1a;
                var temp15 = temp14 + 0x20;
                memory[temp15:temp15 + 0x20] = 0x6e656564206d6f72652074696d6520666f722072656365697665000000000000;
                var temp16 = memory[0x40:0x60];
                revert(memory[temp16:temp16 + (temp15 + 0x20) - temp16]);
            }
        } else {
            var temp17 = memory[0x40:0x60];
            memory[temp17:temp17 + 0x20] = 0x08c379a000000000000000000000000000000000000000000000000000000000;
            var temp18 = temp17 + 0x04;
            var temp19 = temp18 + 0x20;
            memory[temp18:temp18 + 0x20] = temp19 - temp18;
            memory[temp19:temp19 + 0x20] = 0x0d;
            var temp20 = temp19 + 0x20;
            memory[temp20:temp20 + 0x20] = 0x636f6f6c54696d65206973203000000000000000000000000000000000000000;
            var temp21 = memory[0x40:0x60];
            revert(memory[temp21:temp21 + (temp20 + 0x20) - temp21]);
        }
    }

    function func_0C5D(var arg0) {
        if (arg0 & 0xffffffffffffffffffffffffffffffffffffffff != 0xffffffffffffffffffffffffffffffffffffffff & 0x00) {
            var temp0 = arg0;
            var temp1 = memory[0x40:0x60];
            log(memory[temp1:temp1 + memory[0x40:0x60] - temp1], [0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0, storage[0x00] & 0xffffffffffffffffffffffffffffffffffffffff, stack[-1] & 0xffffffffffffffffffffffffffffffffffffffff]);
            storage[0x00] = (temp0 & 0xffffffffffffffffffffffffffffffffffffffff) | (storage[0x00] & ~0xffffffffffffffffffffffffffffffffffffffff);
            return;
        } else {
            var temp2 = memory[0x40:0x60];
            memory[temp2:temp2 + 0x20] = 0x08c379a000000000000000000000000000000000000000000000000000000000;
            var temp3 = temp2 + 0x04;
            var temp4 = temp3 + 0x20;
            memory[temp3:temp3 + 0x20] = temp4 - temp3;
            memory[temp4:temp4 + 0x20] = 0x26;
            var temp5 = temp4 + 0x20;
            memory[temp5:temp5 + 0x26] = code[0x0da2:0x0dc8];
            var temp6 = memory[0x40:0x60];
            revert(memory[temp6:temp6 + (temp5 + 0x40) - temp6]);
        }
    }
}
