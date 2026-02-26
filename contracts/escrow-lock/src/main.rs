#![cfg_attr(not(any(feature = "library", test)), no_std)]
#![cfg_attr(not(test), no_main)]

#[cfg(any(feature = "library", test))]
extern crate alloc;

use ckb_std::{
    ckb_constants::Source,
    default_alloc,
    entry,
    high_level::{
        load_cell_lock_hash,
        load_header,
        load_script,
    },
};

#[cfg(not(any(feature = "library", test)))]
entry!(program_entry);

#[cfg(not(any(feature = "library", test)))]
default_alloc!(16384, 1258306, 64);

#[derive(Debug)]
enum ReleaseCondition {
    Signature { recipient_lock_hash: [u8; 32] },
    TimeLock { timestamp: u64 },
}

fn parse_condition(args: &[u8]) -> Result<ReleaseCondition, i8> {
    if args.is_empty() {
        return Err(-1);
    }

    match args[0] {
        // Signature Mode
        0x00 => {
            if args.len() < 33 {
                return Err(-2);
            }

            let mut hash = [0u8; 32];
            hash.copy_from_slice(&args[1..33]);

            Ok(ReleaseCondition::Signature {
                recipient_lock_hash: hash,
            })
        }

        // TimeLock Mode
        0x01 => {
            if args.len() < 9 {
                return Err(-3);
            }

            let ts_bytes: [u8; 8] = args[1..9]
                .try_into()
                .map_err(|_| -4)?;

            let timestamp = u64::from_be_bytes(ts_bytes);

            Ok(ReleaseCondition::TimeLock { timestamp })
        }

        _ => Err(-5),
    }
}

pub fn program_entry() -> i8 {
    let script = match load_script() {
        Ok(s) => s,
        Err(_) => return -10,
    };

    let args = script.args().raw_data();

    let condition = match parse_condition(&args) {
        Ok(c) => c,
        Err(e) => return e,
    };

    match condition {
        ReleaseCondition::Signature {
            recipient_lock_hash,
        } => {
            // 🔐 Check that one of the inputs
            // has the expected lock hash
            let mut index = 0;
            let mut found = false;

            loop {
                match load_cell_lock_hash(index, Source::Input) {
                    Ok(lock_hash) => {
                        if lock_hash[..] == recipient_lock_hash[..] {
                            found = true;
                            break;
                        }
                        index += 1;
                    }
                    Err(_) => break,
                }
            }

            if !found {
                return -20; // No valid signer present
            }
        }

        ReleaseCondition::TimeLock { timestamp } => {
            let header = match load_header(0, Source::Input) {
                Ok(h) => h,
                Err(_) => return -30,
            };

            let current_timestamp = header.raw().timestamp();

            if current_timestamp < timestamp.into() {
                return -31; // Too early
            }
        }
    }

    0 // Success — unlock cell
}