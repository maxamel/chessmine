import logging
import sys


def log_setup(index):
    root = logging.getLogger(f"load_test#{index}")
    root.setLevel(logging.DEBUG)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    # Create a file handler to log messages to a file
    file_handler = logging.FileHandler(f'test_report_{index}.log', mode='w')
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)
    console_handler.setFormatter(formatter)

    root.addHandler(console_handler)
    root.addHandler(file_handler)
    return root
