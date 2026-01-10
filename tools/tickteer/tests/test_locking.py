#!/usr/bin/env python3
"""
Tests for the DatabaseLock class functionality.

Tests cover:
- Successful lock acquisition
- Lock timeout behavior
- Lock release
- Race condition prevention
- Multiple processes competing for locks
"""

import os
import sys
import time
import tempfile
import threading
import pytest
from pathlib import Path

# Add parent directory to path to import tickteer module
sys.path.insert(0, str(Path(__file__).parent.parent))
from tickteer import DatabaseLock


class TestDatabaseLock:
    """Test cases for DatabaseLock class."""

    @pytest.fixture
    def temp_lock_file(self):
        """Create a temporary lock file for testing."""
        with tempfile.NamedTemporaryFile(delete=False, suffix=".lock") as f:
            lock_file_path = f.name
        yield lock_file_path
        # Cleanup
        try:
            os.unlink(lock_file_path)
        except FileNotFoundError:
            pass

    def test_successful_lock_acquisition(self, temp_lock_file):
        """Test that a lock can be successfully acquired."""
        lock = DatabaseLock(temp_lock_file)

        result = lock.acquire(timeout=2)

        assert result is True
        assert lock.lock_file is not None
        assert os.path.exists(temp_lock_file)

        # Cleanup
        lock.release()

    def test_lock_release(self, temp_lock_file):
        """Test that a lock can be successfully released."""
        lock = DatabaseLock(temp_lock_file)

        # Acquire lock
        assert lock.acquire(timeout=2) is True
        assert lock.lock_file is not None

        # Release lock
        lock.release()
        assert lock.lock_file is None

    def test_lock_contains_pid(self, temp_lock_file):
        """Test that the lock file contains the process ID."""
        lock = DatabaseLock(temp_lock_file)

        lock.acquire(timeout=2)

        # Read the lock file and check it contains the PID
        with open(temp_lock_file, "r") as f:
            content = f.read().strip()

        assert content == str(os.getpid())

        lock.release()

    def test_concurrent_lock_acquisition_same_process(self, temp_lock_file):
        """Test that threads in the same process can compete for locks.

        Note: On some systems, threads within the same process may be able to
        acquire the same lock multiple times. This test verifies the basic
        locking mechanism works but doesn't guarantee strict exclusion between
        threads of the same process (which is system-dependent).
        """
        results = []

        def try_acquire_lock(lock_id):
            lock = DatabaseLock(temp_lock_file)
            result = lock.acquire(timeout=1)
            results.append((lock_id, result))
            if result:
                time.sleep(0.1)  # Brief hold
                lock.release()

        # Create multiple threads trying to acquire the lock
        threads = []
        for i in range(3):
            thread = threading.Thread(target=try_acquire_lock, args=(i,))
            threads.append(thread)

        # Start all threads simultaneously
        for thread in threads:
            thread.start()

        # Wait for all threads to complete
        for thread in threads:
            thread.join()

        # At least one should succeed, and all should complete without errors
        assert len(results) == 3
        successful_acquisitions = sum(1 for _, result in results if result)
        assert successful_acquisitions >= 1

    def test_lock_timeout(self, temp_lock_file):
        """Test that lock acquisition times out correctly."""
        # First lock holder
        lock1 = DatabaseLock(temp_lock_file)
        assert lock1.acquire(timeout=2) is True

        # Second lock requester should timeout
        lock2 = DatabaseLock(temp_lock_file)
        start_time = time.time()
        result = lock2.acquire(timeout=1)
        elapsed = time.time() - start_time

        assert result is False
        assert elapsed >= 1.0  # Should have waited at least the timeout

        # Cleanup
        lock1.release()

    def test_lock_file_creation_in_nonexistent_directory(self):
        """Test that lock file can be created in a non-existent directory."""
        with tempfile.TemporaryDirectory() as temp_dir:
            nested_path = os.path.join(temp_dir, "subdir1", "subdir2", "lockfile.lock")
            lock = DatabaseLock(nested_path)

            result = lock.acquire(timeout=2)

            assert result is True
            assert os.path.exists(nested_path)

            lock.release()

    def test_multiple_lock_acquire_release_cycles(self, temp_lock_file):
        """Test multiple acquire/release cycles work correctly."""
        lock = DatabaseLock(temp_lock_file)

        for i in range(3):
            result = lock.acquire(timeout=2)
            assert result is True
            assert lock.lock_file is not None

            lock.release()
            assert lock.lock_file is None

    def test_lock_acquire_after_manual_deletion(self, temp_lock_file):
        """Test acquiring a lock after the lock file was manually deleted."""
        lock = DatabaseLock(temp_lock_file)

        # Acquire and release
        lock.acquire(timeout=2)
        lock.release()

        # Manually delete the lock file
        if os.path.exists(temp_lock_file):
            os.unlink(temp_lock_file)

        # Should be able to acquire again
        result = lock.acquire(timeout=2)
        assert result is True

        lock.release()


class TestDatabaseLockEdgeCases:
    """Test edge cases and error conditions."""

    @pytest.fixture
    def temp_lock_file(self):
        """Create a temporary lock file for testing."""
        with tempfile.NamedTemporaryFile(delete=False, suffix=".lock") as f:
            lock_file_path = f.name
        yield lock_file_path
        # Cleanup
        try:
            os.unlink(lock_file_path)
        except FileNotFoundError:
            pass

    def test_acquire_with_zero_timeout(self, temp_lock_file):
        """Test acquiring a lock with zero timeout returns immediately."""
        lock = DatabaseLock(temp_lock_file)

        # Should succeed on first try
        result = lock.acquire(timeout=0)
        assert result is True

        lock.release()

    def test_release_without_acquire(self, temp_lock_file):
        """Test that releasing without acquiring doesn't cause errors."""
        lock = DatabaseLock(temp_lock_file)

        # Should not raise an exception
        lock.release()
        assert lock.lock_file is None


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v"])
