import nacl.signing
from nacl.encoding import RawEncoder
import base58

# Updated Constants from your JS values
GAME_ADDRESS = base58.b58decode("GfbKuZ3dc66eopCCAhgPW9He8fJHjdzSwJk9ZGW8fdbg")
USER_ADDRESS = base58.b58decode("48RyrPrUCQDJ1dfZqWQMYQMPvnHM7TRrEYg6XhGGksU3")
WITHDRAW_ID = bytes.fromhex("f0a3d5d4e771aa94fdbd648b088950ca13366421dc73904c00e40b5402000000")  # 32 bytes
WITHDRAW_AUTHORITY_PUBKEY = base58.b58decode("34J9CuBrztXXg4zZ57smvU2j2QPpXxB4ZfxfpvZZCy6V")
WITHDRAW_AUTHORITY_PRIVKEY = bytes.fromhex("a27d22b89bb9c6da513ae2e46c29d423a8900e1cf6b0d476940f5056dadd71171e8f7f8a0a27ef1372db3d1d2f710537632aec24d3b56997962c44f5c139d396")
EXISTING_SIGNATURE = bytes.fromhex("97157b1eed488cfa499b4913436e51a5c24e7afca03acc330c5bb6732e5280025f43df2626b1ed30183e4dd2ad8d964b011ce5b941a6f564f93cb05432abae08")  # 64 bytes

def create_message():
    """Create the message that needs to be signed"""
    message = bytearray(96)
    message[0:32] = GAME_ADDRESS
    message[32:64] = USER_ADDRESS
    message[64:96] = WITHDRAW_ID
    return bytes(message)

def verify_existing_signature():
    """Verify the existing signature"""
    message = create_message()

    # Verify the signature using the authority's public key
    verify_key = nacl.signing.VerifyKey(WITHDRAW_AUTHORITY_PUBKEY)
    try:
        verify_key.verify(message, EXISTING_SIGNATURE, encoder=RawEncoder)
        print("✅ Existing signature verification successful!")
        return True
    except Exception as e:
        print("❌ Existing signature verification failed!", e)
        return False

def create_new_signature():
    """Create a new signature using the private key"""
    message = create_message()

    signing_key = nacl.signing.SigningKey(WITHDRAW_AUTHORITY_PRIVKEY[0:32])

    # Sign the message
    signature = signing_key.sign(message, encoder=RawEncoder).signature

    print(f"🔑 New signature created: {signature.hex()}")

    # Verify the new signature
    verify_key = nacl.signing.VerifyKey(WITHDRAW_AUTHORITY_PUBKEY)
    try:
        verify_key.verify(message, signature, encoder=RawEncoder)
        print("✅ New signature verification successful!")

        # Check if the new signature matches the existing one
        if signature == EXISTING_SIGNATURE:
            print("🔄 New signature matches the existing signature")
        else:
            print("⚠️ New signature does not match the existing signature")
            print(f"   New signature: {signature.hex()}")
            print(f"   Existing sig: {EXISTING_SIGNATURE.hex()}")

        return signature
    except Exception as e:
        print("❌ New signature verification failed!", e)
        return None

if __name__ == "__main__":
    print("=== Verifying Existing Signature ===")
    verify_existing_signature()

    print("\n=== Creating New Signature ===")
    new_signature = create_new_signature()
