import json

from load_test import main
from log_setter import log_setup
from report import Report


if __name__ == '__main__':
    with open("config.json") as json_file:
        json_data = json.load(json_file)
        cycles = json_data["cycles"]
        players = json_data["players"]
        rounds_per_player = json_data["rounds_per_player"]
        endpoint = json_data["endpoint"]
        redis_host = json_data["redis_host"]
        redis_port = json_data["redis_port"]
        report: Report = Report()
        for i in range(int(cycles)):
            logger = log_setup(i)
            preliminary_report: Report = main(player_count=players, logger=logger, games_per_player=rounds_per_player,
                                              endpoint=endpoint, redis_host=redis_host, redis_port=redis_port)
            report = report.combine(preliminary_report)

        print(f"Preliminary Report:\n{report.stringify(cycles=cycles)}\n\n\n")

        print(f"Final Report:\n{report.average(cycles).stringify()}\n\n\n")

