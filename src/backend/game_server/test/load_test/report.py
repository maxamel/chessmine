
class Report:

    def __init__(self, test_duration=0, throughput=0, games_played=0, games_planned=0, timeouts=0,
                 aborts=0, errors=0, timerunouts=0, success=True):
        self.test_duration = test_duration
        self.throughput = throughput
        self.games_played = games_played
        self.games_planned = games_planned
        self.timeouts = timeouts
        self.aborts = aborts
        self.errors = errors
        self.timerunouts = timerunouts
        self.success = success

    def combine(self, other):
        return Report(test_duration=self.test_duration + other.test_duration,
                      throughput=self.throughput + other.throughput,
                      games_played=self.games_played + other.games_played,
                      games_planned=self.games_planned + other.games_planned,
                      timeouts=self.timeouts + other.timeouts,
                      aborts=self.aborts + other.aborts,
                      errors=self.errors + other.errors,
                      timerunouts=self.timerunouts + other.timerunouts,
                      success=self.success and other.success)

    def average(self, cycles):
        return Report(test_duration=self.test_duration/cycles,
                      throughput=self.throughput/cycles,
                      games_played=self.games_played / cycles,
                      games_planned=self.games_planned / cycles,
                      timeouts=self.timeouts/cycles,
                      aborts=self.aborts/cycles,
                      errors=self.errors/cycles,
                      timerunouts=self.timerunouts/cycles,
                      success=self.success)

    def stringify(self, cycles=1) -> str:
        success_rate = float("{:.2f}".format(100 * (self.games_played/self.games_planned)))
        return f"************************************\n\n\n" \
            f"TEST SUCCESS STATUS: {self.success}\n" \
            f"Total game testing lasted {self.test_duration} seconds\n" \
            f"************************************\n" \
            f'Tests completed with {self.timeouts} timeouts, {self.errors} errors, {self.aborts} aborts, ' \
            f'{self.timerunouts} timerunouts and {self.games_played}/{self.games_planned} completed games\n' \
            f"************************************\n" \
            f'Games completed: {self.games_played} completed games with {success_rate}% success rate\n' \
            f"************************************\n" \
            f'Game throughput: {self.throughput}\n' \
            f"************************************\n\n\n"