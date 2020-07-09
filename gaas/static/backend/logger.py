import logging, sys, json
from logging import StreamHandler
from logging.handlers import WatchedFileHandler, RotatingFileHandler

_LOGGER = None

def get_logger(prefix="Default", debug=False):
    """
    returns initialized logger object
    :param prefix:
    :param debug:
    :return:
    """
    global _LOGGER
    if _LOGGER is None:
        _LOGGER = _init_logger(prefix="", debug=False)

    return logging.getLogger(prefix)


def _init_logger(prefix="", debug=True):
    """
    Creates logger object with specific params
    :param prefix:
    :param debug:
    :return:
    """
    my_log_level = logging.DEBUG if debug is True else logging.INFO
    logger = logging.getLogger(prefix)
    # the_format = '%(asctime)s [%(threadName)s:%(thread)d] [%(levelname)s] [%(name)s] %(message)s'

    the_format = '[%(asctime)s][%(thread)d][%(levelname)s][%(name)s][%(filename)s:%(lineno)d][%(funcName)s] %(message)s'
    the_json_format = '%(message)s'
    normal_formatter = logging.Formatter(the_format)
    json_formatter = logging.Formatter(the_json_format)

    file_logging_level = logging.DEBUG
    log_to_file = True
    if log_to_file is True:
        log_filename = "log"
        # rotator_thread = threading.Thread(target=logrotator, args=(log_filename, ))
        # rotator_thread.setDaemon(True)
        # rotator_thread.start()
        print("Logging to file: %s " % log_filename)
        fh = WatchedFileHandler(log_filename)
        fh.setLevel(file_logging_level)
        fh.setFormatter(normal_formatter)
        size = 1024 * 1024 * 100  # 100 MB per log file
        rotator = RotatingFileHandler(log_filename, maxBytes=size, backupCount=5)
        logger.addHandler(fh)
        logger.addHandler(rotator)

    stdout_logger = StdoutLogger()
    stdout_logger.setLevel(my_log_level)
    use_json_logs = True
    if use_json_logs:
        stdout_logger.setFormatter(json_formatter)
    else:
        stdout_logger.setFormatter(normal_formatter)
    stdout_logger.stream = sys.stdout
    logger.addHandler(stdout_logger)

    logger.setLevel(file_logging_level)

    logging.getLogger('socketio').setLevel(logging.ERROR)
    logging.getLogger('engineio').setLevel(logging.ERROR)
    logging.getLogger('geventwebsocket.handler').setLevel(logging.ERROR)

    return logger


class StdoutLogger(StreamHandler):

    def __extract_extra_data(self, record):
        additional_data = {}
        for key, value in record.__dict__.items():
            if not (hasattr(key, "startswith") and key.startswith('_')):
                additional_data[key] = value

        return additional_data

    def emit(self, record):
        additional_params = self.__extract_extra_data(record)
        use_json_logs = True
        if use_json_logs:
            the_msg = record.msg

            if isinstance(the_msg, tuple):
                the_msg = str(the_msg)
            record.msg = json.dumps({'timestamp': record.created,
                                     'asctime': record.asctime,
                                     'level': record.levelname,
                                     'severity': record.levelname,
                                     'thread': record.thread,
                                     'name': record.name,
                                     'filename': record.filename,
                                     'lineno': record.lineno,
                                     'funcname': record.funcName,
                                     'message': "%s" % the_msg,
                                     **additional_params,
                                     })

        super().emit(record)
