# Python 3 program for Elo Rating
import math


# Function to calculate the Probability
def Probability(rating1, rating2):
    return 1.0 * 1.0 / (1 + 1.0 * math.pow(10, 1.0 * (rating1 - rating2) / 400))


# Function to calculate Elo rating
# K is a constant.
# d determines whether
# Player A wins or Player B.
def EloRating(Ra, Rb, d, K = 20):
    # To calculate the Winning
    # Probability of Player B
    Pb = Probability(Ra, Rb)

    # To calculate the Winning
    # Probability of Player A
    Pa = Probability(Rb, Ra)


    Old_Ra = Ra
    Old_Rb = Rb
    # Case -1 When Player A wins
    # Updating the Elo Ratings
    if (d == 1):
        # Ra wins
        Ra = Ra + K * (1 - Pa)
        Rb = Rb + K * (0 - Pb)
    elif (d == 2):
        # Rb wins
        Ra = Ra + K * (0 - Pa)
        Rb = Rb + K * (1 - Pb)
    elif (d == 0):
        # Draw
        Ra = Ra + K * (0.5 - Pa)
        Rb = Rb + K * (0.5 - Pb)

    if Old_Ra != Old_Rb:
        if math.fabs(Ra-Old_Ra) < 1:     # difference smaller than 1
            if Ra > Old_Ra:
                Ra = Old_Ra + 1
            else:
                Ra = Old_Ra - 1

        if math.fabs(Rb-Old_Rb) < 1:     # difference smaller than 1
            if Rb > Old_Rb:
                Rb = Old_Rb + 1
            else:
                Rb = Old_Rb - 1

    return int(Ra), int(Rb)
