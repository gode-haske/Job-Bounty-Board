(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-TASK-NOT-FOUND (err u101))
(define-constant ERR-INSUFFICIENT-FUNDS (err u102))
(define-constant ERR-ALREADY-SUBMITTED (err u103))
(define-constant ERR-NO-SUBMISSION (err u104))
(define-constant ERR-ALREADY-APPROVED (err u105))
(define-constant ERR-TASK-CLOSED (err u106))

(define-map tasks
  { task-id: uint }
  {
    employer: principal,
    description: (string-utf8 500),
    bounty: uint,
    is-open: bool,
    is-completed: bool
  }
)

(define-map submissions
  { task-id: uint, worker: principal }
  {
    proof: (string-utf8 500),
    timestamp: uint,
    is-approved: bool
  }
)

(define-data-var task-id-counter uint u0)

(define-read-only (get-task (task-id uint))
  (map-get? tasks { task-id: task-id })
)

(define-read-only (get-submission (task-id uint) (worker principal))
  (map-get? submissions { task-id: task-id, worker: worker })
)

(define-read-only (get-next-task-id)
  (var-get task-id-counter)
)

(define-public (post-task (description (string-utf8 500)) (bounty uint))
  (let
    (
      (task-id (var-get task-id-counter))
    )
    (asserts! (>= (stx-get-balance tx-sender) bounty) ERR-INSUFFICIENT-FUNDS)

    (map-set tasks
      { task-id: task-id }
      {
        employer: tx-sender,
        description: description,
        bounty: bounty,
        is-open: true,
        is-completed: false
      }
    )

    (try! (stx-transfer? bounty tx-sender (as-contract tx-sender)))

    (var-set task-id-counter (+ task-id u1))

    (ok task-id)
  )
)

(define-public (submit-proof (task-id uint) (proof (string-utf8 500)))
  (let
    (
      (task (unwrap! (get-task task-id) ERR-TASK-NOT-FOUND))
      (existing-submission (get-submission task-id tx-sender))
    )
    (asserts! (get is-open task) ERR-TASK-CLOSED)

    (asserts! (is-none existing-submission) ERR-ALREADY-SUBMITTED)

    (map-set submissions
      { task-id: task-id, worker: tx-sender }
      {
        proof: proof,
        timestamp: u0,
        is-approved: false
      }
    )

    (ok true)
  )
)

(define-public (approve-submission (task-id uint) (worker principal))
  (let
    (
      (task (unwrap! (get-task task-id) ERR-TASK-NOT-FOUND))
      (submission (unwrap! (get-submission task-id worker) ERR-NO-SUBMISSION))
    )
    (asserts! (is-eq tx-sender (get employer task)) ERR-NOT-AUTHORIZED)

    (asserts! (get is-open task) ERR-TASK-CLOSED)

    (asserts! (not (get is-approved submission)) ERR-ALREADY-APPROVED)

    (map-set submissions
      { task-id: task-id, worker: worker }
      (merge submission { is-approved: true })
    )

    (map-set tasks
      { task-id: task-id }
      (merge task { is-open: false, is-completed: true })
    )

    (as-contract (stx-transfer? (get bounty task) tx-sender worker))
  )
)

(define-public (cancel-task (task-id uint))
  (let
    (
      (task (unwrap! (get-task task-id) ERR-TASK-NOT-FOUND))
    )
    (asserts! (is-eq tx-sender (get employer task)) ERR-NOT-AUTHORIZED)

    (asserts! (get is-open task) ERR-TASK-CLOSED)

    (map-set tasks
      { task-id: task-id }
      (merge task { is-open: false, is-completed: false })
    )

    (as-contract (stx-transfer? (get bounty task) tx-sender (get employer task)))
  )
)

(define-public (withdraw-submission (task-id uint))
  (let
    (
      (task (unwrap! (get-task task-id) ERR-TASK-NOT-FOUND))
      (submission (unwrap! (get-submission task-id tx-sender) ERR-NO-SUBMISSION))
    )
    (asserts! (get is-open task) ERR-TASK-CLOSED)

    (asserts! (not (get is-approved submission)) ERR-ALREADY-APPROVED)

    (map-delete submissions { task-id: task-id, worker: tx-sender })

    (ok true)
  )
)
