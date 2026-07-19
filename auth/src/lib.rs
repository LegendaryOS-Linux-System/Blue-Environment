use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::process::Command;

/// Where a user's pattern-lock hash is stored, relative to their home directory.
pub const PATTERN_HASH_RELATIVE_PATH: &str = ".config/Blue-Environment/pattern.hash";

/// Minimum number of cells a pattern must visit to be accepted.
/// (Android-style 3x3 grid, cells encoded as indices 0-8.)
pub const MIN_PATTERN_LEN: usize = 4;

/// Absolute path to the pattern-lock hash file for a given home directory.
pub fn pattern_hash_path(home: impl AsRef<Path>) -> PathBuf {
    home.as_ref().join(PATTERN_HASH_RELATIVE_PATH)
}

/// Hash a pattern the same way everywhere: SHA-256 of `"{username}:{pattern_bytes}"`.
///
/// Salting with the username means one user's stored hash can never be replayed
/// against another user's account even if the pattern bytes happen to match.
pub fn hash_pattern(username: &str, pattern: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(username.as_bytes());
    hasher.update(b":");
    hasher.update(pattern);
    format!("{:x}", hasher.finalize())
}

/// Validate pattern length before hashing/storing/comparing. Kept as a free
/// function so all three call sites reject the same "too short" patterns.
pub fn validate_pattern_len(pattern: &[u8]) -> Result<(), String> {
    if pattern.len() < MIN_PATTERN_LEN {
        Err(format!("Pattern too short (minimum {MIN_PATTERN_LEN} points)"))
    } else {
        Ok(())
    }
}

/// Verify a submitted pattern against the stored hash for `username`/`home`.
/// Fails closed: if no pattern has been configured, authentication fails
/// rather than silently succeeding.
pub fn verify_pattern(username: &str, home: impl AsRef<Path>, pattern: &[u8]) -> Result<(), String> {
    validate_pattern_len(pattern)?;
    let path = pattern_hash_path(home);
    let stored = std::fs::read_to_string(&path)
        .map_err(|_| "No pattern configured for this user — set one up in Settings → Security".to_string())?;
    if hash_pattern(username, pattern) == stored.trim() {
        Ok(())
    } else {
        Err("Pattern not recognised".to_string())
    }
}

/// Store a new pattern-lock hash for `username`/`home`, creating the
/// `.config/Blue-Environment` directory if needed.
pub fn save_pattern(username: &str, home: impl AsRef<Path>, pattern: &[u8]) -> Result<(), String> {
    validate_pattern_len(pattern)?;
    let path = pattern_hash_path(home);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, hash_pattern(username, pattern)).map_err(|e| e.to_string())
}

/// Remove a user's stored pattern-lock hash, if any.
pub fn delete_pattern(home: impl AsRef<Path>) -> Result<(), String> {
    let path = pattern_hash_path(home);
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// Whether `username` has a pattern-lock hash on disk.
pub fn pattern_is_configured(home: impl AsRef<Path>) -> bool {
    pattern_hash_path(home).exists()
}

/// Whether `username` has at least one fingerprint enrolled via fprintd.
/// Shells out to `fprintd-list`, same as both BEDM's greeter and the main
/// desktop session previously did independently.
pub fn has_fingerprint(username: &str) -> bool {
    Command::new("fprintd-list")
        .arg(username)
        .output()
        .map(|o| o.status.success() && !String::from_utf8_lossy(&o.stdout).contains("no fingers"))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_pattern_different_users_hash_differently() {
        let a = hash_pattern("alice", &[0, 1, 2, 5]);
        let b = hash_pattern("bob", &[0, 1, 2, 5]);
        assert_ne!(a, b);
    }

    #[test]
    fn hash_is_deterministic() {
        assert_eq!(hash_pattern("alice", &[0, 1, 2, 5]), hash_pattern("alice", &[0, 1, 2, 5]));
    }

    #[test]
    fn rejects_short_patterns() {
        assert!(validate_pattern_len(&[0, 1]).is_err());
        assert!(validate_pattern_len(&[0, 1, 2, 3]).is_ok());
    }
}
