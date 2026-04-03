from pyteal import *


def approval_program():
    invoice_hash_key = Bytes("invoice_hash")
    owner_key = Bytes("owner")
    status_key = Bytes("status")

    @Subroutine(TealType.none)
    def write_invoice(invoice_id: Expr, invoice_hash: Expr, owner: Expr):
        prefix = Concat(Bytes("inv:"), invoice_id, Bytes(":"))
        return Seq(
            App.globalPut(Concat(prefix, invoice_hash_key), invoice_hash),
            App.globalPut(Concat(prefix, owner_key), owner),
            App.globalPut(Concat(prefix, status_key), Bytes("pending"))
        )

    @Subroutine(TealType.bytes)
    def get_invoice_hash(invoice_id: Expr):
        return App.globalGet(Concat(Bytes("inv:"), invoice_id, Bytes(":invoice_hash")))

    @Subroutine(TealType.bytes)
    def get_owner(invoice_id: Expr):
        return App.globalGet(Concat(Bytes("inv:"), invoice_id, Bytes(":owner")))

    @Subroutine(TealType.bytes)
    def get_status(invoice_id: Expr):
        return App.globalGet(Concat(Bytes("inv:"), invoice_id, Bytes(":status")))

    create_invoice = Seq(
        Assert(Txn.application_args.length() == Int(4)),
        write_invoice(
            Txn.application_args[1],  # invoice_id
            Txn.application_args[2],  # invoice_hash
            Txn.application_args[3],  # owner
        ),
        Return(Int(1)),
    )

    verify_invoice = Seq(
        Assert(Txn.application_args.length() == Int(2)),
        Log(get_invoice_hash(Txn.application_args[1])),
        Log(get_owner(Txn.application_args[1])),
        Log(get_status(Txn.application_args[1])),
        Return(Int(1)),
    )

    return Cond(
        [Txn.application_id() == Int(0), Return(Int(1))],
        [Txn.on_completion() == OnComplete.DeleteApplication, Return(Int(0))],
        [Txn.application_args[0] == Bytes("create_invoice"), create_invoice],
        [Txn.application_args[0] == Bytes("verify_invoice"), verify_invoice],
    )


def clear_program():
    return Return(Int(1))


if __name__ == "__main__":
    print(compileTeal(approval_program(), mode=Mode.Application, version=8))
