import pytest

from app.pyexec.executor import executor


@pytest.mark.asyncio
async def test_runs_normal_code():
    r = await executor.run("print('hi', 2 + 2)")
    assert r.stdout.strip() == "hi 4"
    assert r.exit_code == 0
    assert r.timed_out is False


@pytest.mark.asyncio
async def test_timeout_on_infinite_loop():
    r = await executor.run("while True:\n    pass", timeout_s=2)
    assert r.timed_out is True


@pytest.mark.asyncio
async def test_extra_files_readable():
    r = await executor.run("print(open('data.txt').read())", extra_files={"data.txt": "xyz"})
    assert "xyz" in r.stdout


@pytest.mark.asyncio
async def test_network_blocked_when_sandboxed():
    r = await executor.run(
        "import socket\n"
        "try:\n"
        "    socket.create_connection(('1.1.1.1', 80), timeout=3)\n"
        "    print('ALLOWED')\n"
        "except Exception as e:\n"
        "    print('blocked', type(e).__name__)"
    )
    if r.sandboxed:
        assert "blocked" in r.stdout
    else:
        pytest.skip("sandbox-exec not available")
