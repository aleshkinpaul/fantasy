import { gql } from "apollo-angular";

export const SQUADS_REQUEST_TEMPLATE = gql`
query GetSquads($userID: ID, $seasonID: ID){
  fantasyQueries {
    squads(input:{ userID: $userID, seasonID: $seasonID }) {
      id
      name
      user {               
        id
        nick
        url
        firstName
        middleName
        lastName
      }
      score
      seasonScoreInfo(leagueID: 25389) {
        place
        score
        totalPlaces
      }
      leagues (input:{}){
        league {
          id
          name
        }
        place
        totalPlaces
        placeDiff
        topPercent
      }
    }
  }
}
`

export const TOURS_REQUEST_TEMPLATE = gql`
query GetTours($squadID: ID!, $tourID: ID!){
  fantasyQueries {
		squadTourInfo(input:{ squadID: $squadID, tourID: $tourID }) {
      tour {
        id
        name
        startedAt
      }
      players {
        seasonPlayer {
          id
          name
          price
          role
          statObject {
            id
            name
            firstName
            lastName
            fieldPosition
            height
            weight
            dateOfBirth
            nationality {
              name
            }
            preferredFoot
          }
          team {
          	id
            svgKit {
              url
            }
            name
            statObject {
              id
              name
              country {
                name
              }
              logotype {
                url
              }
            }
          }          
        }
        isCaptain
        isViceCaptain
        isStarting
        substitutePriority
        statDetails {
          score
          reason
        }
        statPlayer {
          goals
          assists
          saves
          penaltiesMissed
          penaltiesPost
          penaltiesTarget
          penaltiesSaved
          fieldMinutes
          yellowCards
          redCards
          goalsConceded
          penaltyGoalsConceded
          penaltiesFaced
          points
        }
        playedMatches
        score
        isPointsCount
      }
      scoreInfo(leagueID: 25389) {
        place
        score
        totalPlaces
        averageScore
        placeDiff
      }
      totalPrice
      transfersDone
    }
  }
}
`