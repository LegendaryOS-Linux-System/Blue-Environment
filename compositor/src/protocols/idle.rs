use smithay::reexports::calloop::{LoopHandle, timer::{Timer, TimeoutAction}};
use tracing::info;
use crate::{state::BlueState, ipc};

/// Install the idle timer into the calloop event loop.
/// The timer fires after `state.dpms_timeout`; on activity it is reset.
pub fn init_idle(
    state: &BlueState,
    loop_handle: &LoopHandle<'static, BlueState>,
) {
    let timeout = state.dpms_timeout;
    if timeout.is_zero() {
        info!("DPMS disabled (timeout = 0)");
        return;
    }

    loop_handle.insert_source(
        Timer::from_duration(timeout),
        move |_, _, state: &mut BlueState| {
            on_idle(state);
            // Re-arm for the next cycle (will be cancelled by activity)
            TimeoutAction::ToDuration(state.dpms_timeout)
        },
    ).ok();

    info!("Idle timer armed: {:?}", timeout);
}

fn on_idle(state: &mut BlueState) {
    if state.is_idle { return; }
    state.is_idle = true;
    info!("System idle — blanking outputs");

    // Blank all outputs via DPMS or wlr-output-power-management
    for output in state.space.outputs() {
        let name = output.name();
        // Try wlr-output-power-management first, fall back to xset/vbetool
        let _ = std::process::Command::new("sh")
            .arg("-c")
            .arg(format!(
                "wlr-randr --output {} --off 2>/dev/null || xset dpms force off 2>/dev/null",
                name
            ))
            .spawn();
    }

    // Notify shell via IPC
    let clients = state.clients.clone();
    ipc::broadcast_idle_changed(&clients, true);
}

/// Called from the input handler whenever there is keyboard or pointer activity.
pub fn reset_idle(state: &mut BlueState) {
    if !state.is_idle { return; }
    state.is_idle = false;
    info!("Activity detected — waking outputs");

    for output in state.space.outputs() {
        let name = output.name();
        let _ = std::process::Command::new("sh")
            .arg("-c")
            .arg(format!(
                "wlr-randr --output {} --on 2>/dev/null || xset dpms force on 2>/dev/null",
                name
            ))
            .spawn();
    }

    let clients = state.clients.clone();
    ipc::broadcast_idle_changed(&clients, false);
}
