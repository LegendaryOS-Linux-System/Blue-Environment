use smithay::{
    delegate_session_lock,
    reexports::wayland_server::protocol::wl_output::WlOutput,
    wayland::session_lock::{
        LockSurface, SessionLockHandler, SessionLockManagerState, SessionLocker,
    },
};
use tracing::info;
use crate::state::BlueState;

impl SessionLockHandler for BlueState {
    fn lock_state(&mut self) -> &mut SessionLockManagerState {
        &mut self.session_lock_state
    }

    fn lock(&mut self, locker: SessionLocker) {
        info!("session lock requested");
        self.pending_lock = Some(locker);
        self.lock_surfaces.clear();
        // If there happen to be zero outputs (shouldn't normally happen),
        // confirm immediately rather than hanging forever.
        if self.outputs.is_empty() {
            self.confirm_lock_if_ready();
        }
    }

    fn unlock(&mut self) {
        info!("session unlocked");
        self.is_locked = false;
        self.lock_surfaces.clear();
        self.pending_lock = None;
        self.broadcast_lock_state(false);
    }

    fn new_surface(&mut self, surface: LockSurface, output: WlOutput) {
        // Output::owns() resolves a client-visible WlOutput resource back to
        // the compositor's internal smithay::output::Output — the same
        // idiom smithay's own `anvil` reference compositor uses. If a
        // smithay bump ever renames this, `cargo check` will point straight
        // at this line.
        if let Some(smithay_output) = self.outputs.iter().find(|o| o.owns(&output)) {
            self.lock_surfaces.insert(smithay_output.name(), surface);
        }
        self.confirm_lock_if_ready();
    }
}

impl BlueState {
    /// Once the lock client has supplied a `LockSurface` for every connected
    /// output, actually confirm the lock (this is what makes the client's
    /// `ext_session_lock_v1.locked` event fire) and tell the shell.
    fn confirm_lock_if_ready(&mut self) {
        let all_covered = self
            .outputs
            .iter()
            .all(|o| self.lock_surfaces.contains_key(&o.name()));

        if all_covered {
            if let Some(locker) = self.pending_lock.take() {
                locker.lock();
                self.is_locked = true;
                self.broadcast_lock_state(true);
                info!("session lock confirmed — all outputs covered");
            }
        }
    }

    fn broadcast_lock_state(&self, locked: bool) {
        let clients = self.clients.clone();
        crate::ipc::broadcast_screen_locked(&clients, locked);
    }
}

delegate_session_lock!(BlueState);
