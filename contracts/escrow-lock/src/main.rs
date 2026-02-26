#![cfg_attr(not(any(feature = "library", test)), no_std)]
#![cfg_attr(not(test), no_main)]

#[cfg(any(feature = "library", test))]
extern crate alloc;

use ckb_std::high_level::{load_script, load_witness_args};
use ckb_std::ckb_constants::Source;
use blake2b_ref::Blake2bBuilder;


#[cfg(not(any(feature = "library", test)))]
ckb_std::entry!(program_entry);
#[cfg(not(any(feature = "library", test)))]
// By default, the following heap configuration is used:
// * 16KB fixed heap
// * 1.2MB(rounded up to be 16-byte aligned) dynamic heap
// * Minimal memory block in dynamic heap is 64 bytes
// For more details, please refer to ckb-std's default_alloc macro
// and the buddy-alloc alloc implementation.
ckb_std::default_alloc!(16384, 1258306, 64);

pub fn program_entry() -> i8 {
    ckb_std::debug!("Escrow lock script starting...");


    let script = match load_script() {
        Ok(s)=>s,
        Err(_)=>{
            ckb_std::debug!("Failed to load script");
            return -1;
        }
    };

    let args : &[u8] = &script.args().raw_data();

    if args.len() < 32 {
        ckb_std::debug!(" Args length is less than 32 bytes");
        return -1;
    }

    let expected_recipient_hash: &[u8; 32] = &args[0..32].try_into().unwrap();
    ckb_std::debug!("Expected recipient hash: {:?}", expected_recipient_hash);

    0
}
