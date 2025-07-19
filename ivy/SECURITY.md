# Security

Solana programs are a function of the accounts and data passed to them.
On Solana, both the accounts and data passed to a program are entirely
user-controlled.

Thus, in Solana development, it is crucial to rigorously validate
both of these.

_Account ownership_ is a property whose understanding is critical
to the secure behavior of Solana programs. In Solana:

- Accounts are arbitrary byte arrays that can also store native value.
- Account creation is parameterized by two values: (1) the owning program and
  (2) the data length.
- When an account is created, the data array is zeroed. The owning program is
  the only entity that can store non-zero bytes in the data array.
- The owner of an account cannot be changed unless the account data is zeroed.

Using the properties above, it is possible to design a secure model for data storage.
Ivy uses the following:

- To initialize storage, create a new account with the desired length owned by
  the Ivy program. Write a non-zero discriminator to the first few bytes,
  and use the rest to store arbitrary byte values.
- To read from storage, receive an account passed by the Ivy program. Validate:
  (1) the account is owned by the program, and (2) the first few bytes match
  the desired discriminator. We are now assured of the authenticity of the rest
  of the data.

Why does this work?

- We validate that (1) the account is owned by the program. Per the properties
  described earlier, we know that the account is either (a) a zeroed account
  created by the system program, (b) a zeroed account recently assigned to us,
  or (c) a non-zero account _containing data that only our program could have created._
- We validate that (2) the first few bytes match the desired discriminator. Since
  our discriminator is non-zero, possibilities (a) and (b) are eliminated.
  We are left with (c). The account is non-zero, containing data written by us,
  and has the correct discriminator. The data is authentic.

Using this security model, we are assured that Ivy only operates on valid account data.
