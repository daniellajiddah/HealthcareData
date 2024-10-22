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

;; Token for marketplace transactions
(define-fungible-token health-data-token)

;; Initialize token supply
(begin
    (try! (ft-mint? health-data-token u1000000000 contract-owner))
)

;; Add new health data to the marketplace
(define-public (submit-health-data (data-hash (buff 32)) (price uint))
    (let
        ((user tx-sender))
        (asserts! (is-some (map-get? user-data-registry {user: user}))
            (err u104))
        (ok (map-set user-data-registry
            {user: user}
            {
                data-hash: data-hash,
                price: price,
                is-available: true,
                access-control: (list)
            }
        ))
    )
)

;; Register as a researcher
(define-public (register-researcher)
    (let
        ((researcher tx-sender))
        (ok (map-set researcher-registry
            {researcher: researcher}
            {
                is-verified: false,
                purchased-data: (list)
            }
        ))
    )
)

;; Verify researcher (admin only)
(define-public (verify-researcher (researcher principal))
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (ok (map-set researcher-registry
            {researcher: researcher}
            {
                is-verified: true,
                purchased-data: (default-to (list) (get purchased-data (map-get? researcher-registry {researcher: researcher})))
            }
        ))
    )
)