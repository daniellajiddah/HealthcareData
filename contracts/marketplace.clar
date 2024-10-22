;; Healthcare Data Marketplace
;; Allows users to tokenize and sell their health data while maintaining privacy
;; Implements permissioned access and token-based rewards

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-invalid-data (err u101))
(define-constant err-unauthorized (err u102))
(define-constant err-insufficient-funds (err u103))

;; Data Variables
(define-map user-data-registry
    { user: principal }
    {
        data-hash: (buff 32),
        price: uint,
        is-available: bool,
        access-control: (list 10 principal)
    }
)

(define-map researcher-registry
    { researcher: principal }
    {
        is-verified: bool,
        purchased-data: (list 50 (buff 32))
    }
)