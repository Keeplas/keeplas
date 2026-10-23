// Keeps one user-started job (the vault export) running while Keeplas is in
// the background. iOS 26+ runs it as a continued-processing task: the system
// shows its progress and the user can stop it there, which is sent to JS as
// `onExpire`. Older iOS only get the short grace of a background task.
import BackgroundTasks
import ExpoModulesCore
import UIKit

public class KeeplasBackgroundWorkModule: Module {
  private var graceTask: UIBackgroundTaskIdentifier = .invalid
  // A BGContinuedProcessingTask (iOS 26+) once the system has launched it.
  private var task: BGTask?
  private var running = false
  private var done: Int64 = 0
  private var total: Int64 = 0

  public func definition() -> ModuleDefinition {
    Name("KeeplasBackgroundWork")

    Events("onExpire")

    AsyncFunction("begin") { (title: String, subtitle: String) in
      self.finish(success: false)
      self.running = true
      self.done = 0
      self.total = 0
      if #available(iOS 26.0, *), self.submitContinued(title: title, subtitle: subtitle) {
        return
      }
      self.graceTask = UIApplication.shared.beginBackgroundTask(withName: "keeplas.export") {
        self.endGrace()
      }
    }.runOnQueue(.main)

    AsyncFunction("progress") { (done: Int, total: Int) in
      self.done = Int64(done)
      self.total = Int64(total)
      self.reportProgress()
    }.runOnQueue(.main)

    AsyncFunction("end") { (success: Bool) in
      self.finish(success: success)
    }.runOnQueue(.main)
  }

  @available(iOS 26.0, *)
  private func submitContinued(title: String, subtitle: String) -> Bool {
    guard let bundle = Bundle.main.bundleIdentifier else { return false }
    // Matches the `<bundle>.export.*` wildcard in Info.plist. Unique per job:
    // registering the same identifier twice kills the app.
    let identifier = "\(bundle).export.\(UUID().uuidString)"
    let registered = BGTaskScheduler.shared.register(
      forTaskWithIdentifier: identifier, using: .main
    ) { [weak self] launched in
      guard let self, self.running else {
        launched.setTaskCompleted(success: true)
        return
      }
      launched.expirationHandler = { [weak self] in
        DispatchQueue.main.async {
          guard let self, self.task === launched else { return }
          self.task = nil
          self.running = false
          launched.setTaskCompleted(success: false)
          self.sendEvent("onExpire")
        }
      }
      self.task = launched
      self.reportProgress()
    }
    guard registered else { return false }
    let request = BGContinuedProcessingTaskRequest(
      identifier: identifier, title: title, subtitle: subtitle)
    // Start now or fall back to the background-task grace, never queue.
    request.strategy = .fail
    do {
      try BGTaskScheduler.shared.submit(request)
      return true
    } catch {
      return false
    }
  }

  // The system expires continued-processing tasks that stop reporting progress.
  private func reportProgress() {
    guard #available(iOS 26.0, *), let task = task as? BGContinuedProcessingTask else { return }
    task.progress.totalUnitCount = total
    task.progress.completedUnitCount = done
  }

  private func finish(success: Bool) {
    running = false
    task?.setTaskCompleted(success: success)
    task = nil
    endGrace()
  }

  private func endGrace() {
    guard graceTask != .invalid else { return }
    UIApplication.shared.endBackgroundTask(graceTask)
    graceTask = .invalid
  }
}
