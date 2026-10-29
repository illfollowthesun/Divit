#![cfg(windows)]

// Explicitly opt in: these tests use the real Windows vault, under an isolated service.
// No provider key is written, logged, replaced or deleted.
const SERVICE: &str = "com.firextream.yazi.verification";
const FIXTURE: &str = "verification-only-not-an-api-key";

#[test]
#[ignore = "Uses real Windows Credential Manager; run explicitly"]
fn credentials_survive_process_restart_and_are_removed() {
    let target = format!("restart-{}-{}", std::process::id(), std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
    let entry = keyring::Entry::new(SERVICE, &target).unwrap();
    assert!(matches!(entry.get_password(), Err(keyring::Error::NoEntry)));
    let executable = std::env::current_exe().unwrap();
    let outcome = std::panic::catch_unwind(|| {
        for phase in ["write", "read", "delete", "absent"] {
            let status = std::process::Command::new(&executable)
                .args(["--ignored", "--exact", "credential_child_process", "--nocapture"])
                .env("YAZI_VERIFY_CREDENTIAL_TARGET", &target)
                .env("YAZI_VERIFY_CREDENTIAL_PHASE", phase)
                .status().unwrap();
            assert!(status.success(), "Credential verification phase failed: {phase}");
            println!("Credential phase {phase}: passed in a fresh process");
        }
    });
    // Also clean up if a child fails halfway through the lifecycle.
    let cleanup = entry.delete_credential();
    assert!(matches!(cleanup, Ok(()) | Err(keyring::Error::NoEntry)));
    assert!(outcome.is_ok(), "Credential lifecycle failed; isolated test entry was cleaned up");
}

#[test]
#[ignore = "Child process of credentials_survive_process_restart_and_are_removed"]
fn credential_child_process() {
    let Ok(target) = std::env::var("YAZI_VERIFY_CREDENTIAL_TARGET") else { return };
    assert!(target.starts_with("restart-"));
    let entry = keyring::Entry::new(SERVICE, &target).unwrap();
    match std::env::var("YAZI_VERIFY_CREDENTIAL_PHASE").unwrap().as_str() {
        "write" => entry.set_password(FIXTURE).unwrap(),
        "read" => assert!(entry.get_password().is_ok_and(|value| value == FIXTURE), "Stored fixture was unavailable after process restart"),
        "delete" => entry.delete_credential().unwrap(),
        "absent" => assert!(matches!(entry.get_password(), Err(keyring::Error::NoEntry))),
        _ => panic!("Unknown credential verification phase"),
    }
}

#[test]
#[ignore = "Read-only provider access diagnostic; never displays keys"]
fn report_provider_key_availability_without_secrets() {
    for provider in ["gemini", "anthropic"] {
        let entry = keyring::Entry::new("com.firextream.yazi", &format!("ai-{provider}")).unwrap();
        let present = match entry.get_password() {
            Ok(value) => !value.trim().is_empty(),
            Err(keyring::Error::NoEntry) => false,
            Err(_) => panic!("Credential Manager could not read {provider}'s key status"),
        };
        println!("{provider}: {}", if present { "key available" } else { "MISSING API key" });
    }
}
