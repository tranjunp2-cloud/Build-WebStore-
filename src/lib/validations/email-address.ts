/**
 * Same pattern as Payload's `email` field validator (payload/dist/fields/validations.js), so a form can stop
 * an address on the client that the users collection would reject with its raw "field is invalid: Email" error.
 */
const PAYLOAD_EMAIL_PATTERN =
    /^(?!.*\.\.)[\w!#$%&'*+/=?^`{|}~-](?:[\w!#$%&'*+/=?^`{|}~.-]*[\w!#$%&'*+/=?^`{|}~-])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i

export function isPayloadAcceptedEmail(value: string): boolean {
    return PAYLOAD_EMAIL_PATTERN.test(value)
}
