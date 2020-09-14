import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    Unique,
    CreateDateColumn,
    UpdateDateColumn,
    OneToOne,
    ManyToOne
} from 'typeorm';
import User from './User';

@Entity()
@Unique(['id'])
class FriendsRequest {

    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(type => User, user => user.myRequests)
    requestUser: User;

    @ManyToOne(type => User, user => user.requestsForMe)
    targetUser: User;

    @Column()
    message: string;

    @Column()
    status: boolean;

    @Column()
    seen: boolean;

    @Column()
    sendRequest: boolean;

    @Column()
    @CreateDateColumn()
    createdAt: Date;

    @Column()
    @UpdateDateColumn()
    updatedAt: Date;
};

export default FriendsRequest;