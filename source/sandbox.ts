import { createDeposit } from './tornado';
import { bytes32String } from './utils/bigint';
import { main } from './utils/script-helpers';
import { toHexString } from './utils/typed-arrays';

main(async () => {
	const nullifier = 5n
	const secret = 7n
	const deposit = createDeposit({ nullifier, secret })
	console.log(`preimage     : ${toHexString(deposit.preimage)}`)
	console.log(`commitment   : 0x${bytes32String(deposit.commitment)}`)
	console.log(`nullifierHash: 0x${bytes32String(nullifier)}`)
})
