// JS bridge to the KeeplasBackgroundWork native module. It keeps one
// user-started job (the vault export) running while Keeplas is in the
// background: a continued-processing task on iOS 26+ (the system shows its
// progress; older iOS get a short grace only) or a foreground service with a
// progress notification on Android. The job itself runs in JS.
import { NativeModule, requireNativeModule } from "expo";

declare class NativeBackgroundWork extends NativeModule<{
  onExpire: () => void;
}> {
  begin(title: string, subtitle: string): Promise<void>;
  progress(done: number, total: number): Promise<void>;
  end(success: boolean): Promise<void>;
}

const native = requireNativeModule<NativeBackgroundWork>(
  "KeeplasBackgroundWork",
);

/** `title` / `subtitle` are shown by the system while the job runs. */
export function beginBackgroundWork(title: string, subtitle: string): void {
  void native.begin(title, subtitle);
}

export function reportBackgroundProgress(done: number, total: number): void {
  void native.progress(done, total);
}

export function endBackgroundWork(success: boolean): void {
  void native.end(success);
}

/**
 * The user (iOS) or the system (iOS; Android's data-sync time limit) stopped
 * the job; the caller should cancel it.
 */
export function onBackgroundWorkExpired(listener: () => void): {
  remove: () => void;
} {
  return native.addListener("onExpire", listener);
}
